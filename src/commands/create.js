/*global module, require, console, Promise */
var path = require('path'),
	shell = require('shelljs'),
	aws = require('aws-sdk'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	cleanUpPackage = require('../tasks/clean-up-package'),
	addPolicy = require('../tasks/add-policy'),
	markAlias = require('../tasks/mark-alias'),
	templateFile = require('../util/template-file'),
	validatePackage = require('../tasks/validate-package'),
	retriableWrap = require('../util/retriable-wrap'),
	loggingWrap = require('../util/logging-wrap'),
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	readjson = require('../util/readjson'),
	apiGWUrl = require('../util/apigw-url'),
	lambdaNameSanitize = require('../util/lambda-name-sanitize'),
	retry = require('oh-no-i-insist'),
	fs = require('../util/fs-promise'),
	os = require('os'),
	sequentialPromiseMap = require('../util/sequential-promise-map'),
	lambdaCode = require('../tasks/lambda-code'),
	readEnvVarsFromOptions = require('../util/read-env-vars-from-options'),
	NullLogger = require('../util/null-logger');
module.exports = function create(options, optionalLogger) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		awsDelay = options && options['aws-delay'] && parseInt(options['aws-delay']) || 5000,
		awsRetries = options && options['aws-retries'] && parseInt(options['aws-retries']) || 15,
		source = (options && options.source) || shell.pwd().toString(),
		configFile = (options && options.config) || path.join(source, 'claudia.json'),
		iam = loggingWrap(new aws.IAM(), {log: logger.logApiCall, logName: 'iam'}),
		lambda = loggingWrap(new aws.Lambda({region: options.region}), {log: logger.logApiCall, logName: 'lambda'}),
		apiGatewayPromise = retriableWrap(
						loggingWrap(new aws.APIGateway({region: options.region}), {log: logger.logApiCall, logName: 'apigateway'}),
						function () {
							logger.logStage('rate-limited by AWS, waiting before retry');
						}),
		roleMetadata,
		policyFiles = function () {
			var files = shell.ls('-R', options.policies);
			if (shell.test('-d', options.policies)) {
				files = files.map(function (filePath) {
					return path.join(options.policies, filePath);
				});
			}
			return files.filter(function (filePath) {
				return shell.test('-f', filePath);
			});
		},
		validationError = function () {
			if (source === os.tmpdir()) {
				return 'Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.';
			}
			if (!options.region) {
				return 'AWS region is missing. please specify with --region';
			}
			if (options['optional-dependencies'] === false && options['use-local-dependencies']) {
				return 'incompatible arguments --use-local-dependencies and --no-optional-dependencies';
			}
			if (!options.handler && !options['api-module']) {
				return 'Lambda handler is missing. please specify with --handler';
			}
			if (options.handler && options['api-module']) {
				return 'incompatible arguments: cannot specify handler and api-module at the same time.';
			}
			if (!options.handler && options['deploy-proxy-api']) {
				return 'deploy-proxy-api requires a handler. please specify with --handler';
			}
			if (!options['security-group-ids'] && options['subnet-ids']) {
				return 'VPC access requires at least one security group id *and* one subnet id';
			}
			if (options['security-group-ids'] && !options['subnet-ids']) {
				return 'VPC access requires at least one security group id *and* one subnet id';
			}
			if (options.handler && options.handler.indexOf('.') < 0) {
				return 'Lambda handler function not specified. Please specify with --handler module.function';
			}
			if (options['api-module'] && options['api-module'].indexOf('.') >= 0) {
				return 'API module must be a module name, without the file extension or function name';
			}
			if (shell.test('-e', configFile)) {
				if (options && options.config) {
					return options.config + ' already exists';
				}
				return 'claudia.json already exists in the source folder';
			}
			if (!shell.test('-e', path.join(source, 'package.json'))) {
				return 'package.json does not exist in the source folder';
			}
			if (options.policies && !policyFiles().length) {
				return 'no files match additional policies (' + options.policies + ')';
			}
			if (options.memory || options.memory === 0) {
				if (options.memory < 128) {
					return 'the memory value provided must be greater than or equal to 128';
				}
				if (options.memory > 1536) {
					return 'the memory value provided must be less than or equal to 1536';
				}
				if (options.memory % 64 !== 0) {
					return 'the memory value provided must be a multiple of 64';
				}
			}
			if (options.timeout || options.timeout === 0) {
				if (options.timeout < 1) {
					return 'the timeout value provided must be greater than or equal to 1';
				}
				if (options.timeout > 300) {
					return 'the timeout value provided must be less than or equal to 300';
				}
			}
			try {
				readEnvVarsFromOptions(options);
			} catch (e) {
				return e;
			}
		},
		getPackageInfo = function () {
			logger.logStage('loading package config');
			return readjson(path.join(source, 'package.json')).then(function (jsonConfig) {
				var name = options.name || lambdaNameSanitize(jsonConfig.name),
					description = options.description || (jsonConfig.description && jsonConfig.description.trim());
				if (!name) {
					return Promise.reject('project name is missing. please specify with --name or in package.json');
				}
				return {
					name: name,
					description: description
				};
			});
		},
		createLambda = function (functionName, functionDesc, functionCode, roleArn) {
			return retry(
				function () {
					logger.logStage('creating Lambda');
					return lambda.createFunction({
						Code: functionCode,
						FunctionName: functionName,
						Description: functionDesc,
						MemorySize: options.memory,
						Timeout: options.timeout,
						Environment: readEnvVarsFromOptions(options),
						KMSKeyArn: options['env-kms-key-arn'],
						Handler: options.handler || (options['api-module'] + '.proxyRouter'),
						Role: roleArn,
						Runtime: options.runtime || 'nodejs4.3',
						Publish: true,
						VpcConfig: options['security-group-ids'] && options['subnet-ids'] && {
							SecurityGroupIds: (options['security-group-ids'] && options['security-group-ids'].split(',')),
							SubnetIds: (options['subnet-ids'] && options['subnet-ids'].split(','))
						}
					}).promise();
				},
				awsDelay, awsRetries,
				function (error) {
					return error &&
						error.code === 'InvalidParameterValueException' &&
						error.message == 'The role defined for the function cannot be assumed by Lambda.';
				},
				function () {
					logger.logStage('waiting for IAM role propagation');
				},
				Promise
			);
		},
		markAliases = function (lambdaData) {
			logger.logStage('creating version alias');
			return markAlias(lambdaData.FunctionName, lambda, '$LATEST', 'latest')
			.then(function () {
				if (options.version) {
					return markAlias(lambdaData.FunctionName, lambda, lambdaData.Version, options.version);
				}
			}).then(function () {
				return lambdaData;
			});
		},
		createWebApi = function (lambdaMetadata, packageDir) {
			var apiModule, apiConfig, apiModulePath,
				alias = options.version || 'latest';
			logger.logStage('creating REST API');
			try {
				apiModulePath = path.join(packageDir, options['api-module']);
				apiModule = require(path.resolve(apiModulePath));
				apiConfig = apiModule && apiModule.apiConfig && apiModule.apiConfig();
			}
			catch (e) {
				console.error(e.stack || e);
				return Promise.reject('cannot load api config from ' + apiModulePath);
			}

			if (!apiConfig) {
				return Promise.reject('No apiConfig defined on module \'' + options['api-module'] + '\'. Are you missing a module.exports?');
			}
			return apiGatewayPromise.createRestApiPromise({
				name: lambdaMetadata.FunctionName
			}).then(function (result) {

				lambdaMetadata.api = {
					id: result.id,
					module: options['api-module'],
					url: apiGWUrl(result.id, options.region, alias)
				};
				return rebuildWebApi(lambdaMetadata.FunctionName, alias, result.id, apiConfig, options.region, logger, options['cache-api-config']);
			}).then(function () {
				if (apiModule.postDeploy) {
					Promise.map = sequentialPromiseMap;
					return apiModule.postDeploy(
						options,
						{
							name: lambdaMetadata.FunctionName,
							alias: alias,
							apiId: lambdaMetadata.api.id,
							apiUrl: lambdaMetadata.api.url,
							region: options.region
						},
						{
							apiGatewayPromise: apiGatewayPromise,
							aws: aws,
							Promise: Promise
						}
					);
				}
			}).then(function (postDeployResult) {
				if (postDeployResult) {
					lambdaMetadata.api.deploy = postDeployResult;
				}
				return lambdaMetadata;
			});
		},
		deployProxyApi = function (lambdaMetadata) {
			var apiConfig = {
					version: 3,
					corsHandlers: true,
					routes: {
						'{proxy+}': { ANY: {}},
						'': { ANY: {}}
					}
				},
				alias = options.version || 'latest';
			logger.logStage('creating REST API');

			return apiGatewayPromise.createRestApiPromise({
				name: lambdaMetadata.FunctionName
			}).then(function (result) {
				lambdaMetadata.api = {
					id: result.id,
					url: apiGWUrl(result.id, options.region, alias)
				};
				return rebuildWebApi(lambdaMetadata.FunctionName, alias, result.id, apiConfig, options.region, logger, options['cache-api-config']);
			}).then(function () {
				return lambdaMetadata;
			});
		},
		saveConfig = function (lambdaMetaData) {
			var config = {
				lambda: {
					role: roleMetadata.Role.RoleName,
					name: lambdaMetaData.FunctionName,
					region: options.region
				}
			};
			logger.logStage('saving configuration');
			if (lambdaMetaData.api) {
				config.api =  { id: lambdaMetaData.api.id, module: lambdaMetaData.api.module };
			}
			return fs.writeFileAsync(
				configFile,
				JSON.stringify(config, null, 2),
				'utf8'
			).then(function () {
				return lambdaMetaData;
			});
		},
		s3Key,
		formatResult = function (lambdaMetaData) {
			var config = {
				lambda: {
					role: roleMetadata.Role.RoleName,
					name: lambdaMetaData.FunctionName,
					region: options.region
				}
			};
			if (lambdaMetaData.api) {
				config.api =  lambdaMetaData.api;
			}
			if (s3Key) {
				config.s3key = s3Key;
			}
			return config;
		},
		isRoleArn = function (string) {
			return /^arn:aws:iam:/.test(string);
		},
		loadRole = function (functionName) {
			logger.logStage('initialising IAM role');
			if (options.role) {
				if (isRoleArn(options.role)) {
					return Promise.resolve({
						Role: {
							RoleName: options.role,
							Arn: options.role
						}
					});
				}
				return iam.getRole({RoleName: options.role}).promise();
			} else {
				return fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
					.then(function (lambdaRolePolicy) {
						return iam.createRole({
							RoleName: functionName + '-executor',
							AssumeRolePolicyDocument: lambdaRolePolicy
						}).promise();
					});
			}
		},
		addExtraPolicies = function () {
			return Promise.all(policyFiles().map(function (fileName) {
				var policyName = path.basename(fileName).replace(/[^A-z0-9]/g, '-');
				return addPolicy(policyName, roleMetadata.Role.RoleName, fileName);
			}));
		},
		vpcPolicy = function () {
			return JSON.stringify({
				'Version': '2012-10-17',
				'Statement': [{
					'Sid': 'VPCAccessExecutionPermission',
					'Effect': 'Allow',
					'Action': [
						'logs:CreateLogGroup',
						'logs:CreateLogStream',
						'logs:PutLogEvents',
						'ec2:CreateNetworkInterface',
						'ec2:DeleteNetworkInterface',
						'ec2:DescribeNetworkInterfaces'
					],
					'Resource': '*'
				}]
			});
		},
		recursivePolicy = function (functionName) {
			return JSON.stringify({
				'Version': '2012-10-17',
				'Statement': [{
					'Sid': 'InvokePermission',
					'Effect': 'Allow',
					'Action': [
						'lambda:InvokeFunction'
					],
					'Resource': 'arn:aws:lambda:' + options.region + ':*:function:' + functionName
				}]
			});
		},
		cleanup = function (result) {
			if (!options.keep) {
				shell.rm(packageArchive);
			} else {
				result.archive = packageArchive;
			}
			return result;
		},
		packageArchive,
		functionDesc,
		functionName,
		packageFileDir;
	if (validationError()) {
		return Promise.reject(validationError());
	}
	return getPackageInfo().then(function (packageInfo) {
		functionName = packageInfo.name;
		functionDesc = packageInfo.description;
	}).then(function () {
		return collectFiles(source, options['use-local-dependencies'], logger);
	}).then(function (dir) {
		logger.logStage('validating package');
		return validatePackage(dir, options.handler, options['api-module']);
	}).then(function (dir) {
		packageFileDir = dir;
		return cleanUpPackage(dir, options, logger);
	}).then(function (dir) {
		logger.logStage('zipping package');
		return zipdir(dir);
	}).then(function (zipFile) {
		packageArchive = zipFile;
	}).then(function () {
		return loadRole(functionName);
	}).then(function (result) {
		roleMetadata = result;
	}).then(function () {
		if (!options.role) {
			return addPolicy('log-writer', roleMetadata.Role.RoleName);
		}
	}).then(function () {
		if (options.policies) {
			return addExtraPolicies();
		}
	}).then(function () {
		if (options['security-group-ids']) {
			return iam.putRolePolicy({
				RoleName:  roleMetadata.Role.RoleName,
				PolicyName: 'vpc-access-execution',
				PolicyDocument: vpcPolicy()
			}).promise();
		}
	}).then(function () {
		if (options['allow-recursion']) {
			return iam.putRolePolicy({
				RoleName:  roleMetadata.Role.RoleName,
				PolicyName: 'recursive-execution',
				PolicyDocument: recursivePolicy(functionName)
			}).promise();
		}
	}).then(function () {
		return lambdaCode(packageArchive, options['use-s3-bucket'], logger);
	}).then(function (functionCode) {
		s3Key = functionCode.S3Key;
		return createLambda(functionName, functionDesc, functionCode, roleMetadata.Role.Arn);
	}).then(markAliases)
	.then(function (lambdaMetadata) {
		if (options['api-module']) {
			return createWebApi(lambdaMetadata, packageFileDir);
		} else if (options['deploy-proxy-api']) {
			return deployProxyApi(lambdaMetadata);
		} else {
			return lambdaMetadata;
		}
	})
	.then(saveConfig).then(formatResult).then(cleanup);
};

module.exports.doc = {
	description: 'Create the initial lambda function and related security role.',
	priority: 1,
	args: [
		{
			argument: 'region',
			description: 'AWS region where to create the lambda',
			example: 'us-east-1'
		},
		{
			argument: 'handler',
			optional: true,
			description: 'Main function for Lambda to execute, as module.function',
			example: 'if it is in the main.js file and exported as router, this would be main.router'
		},
		{
			argument: 'api-module',
			optional: true,
			description: 'The main module to use when creating Web APIs. \n' +
				'If you provide this parameter, do not set the handler option.\n' +
				'This should be a module created using the Claudia API Builder.',
			example: 'if the api is defined in web.js, this would be web'
		},
		{
			argument: 'deploy-proxy-api',
			optional: true,
			description: 'If specified, a proxy API will be created for the Lambda \n' +
				' function on API Gateway, and forward all requests to function. \n' +
				' This is an alternative way to create web APIs to --api-module.'
		},
		{
			argument: 'name',
			optional: true,
			description: 'lambda function name',
			example: 'awesome-microservice',
			'default': 'the project name from package.json'
		},
		{
			argument: 'version',
			optional: true,
			description: 'A version alias to automatically assign to the new function',
			example: 'development'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			'default': 'current directory'
		},
		{
			argument: 'config',
			optional: true,
			description: 'Config file where the creation result will be saved',
			'default': 'claudia.json'
		},
		{
			argument: 'policies',
			optional: true,
			description: 'A directory or file pattern for additional IAM policies\n' +
				'which will automatically be included into the security role for the function',
			example: 'policies/*.xml'
		},
		{
			argument: 'allow-recursion',
			optional: true,
			description: 'Set up IAM permissions so a function can call itself recursively'
		},
		{
			argument: 'role',
			optional: true,
			description: 'The name or ARN of an existing role to assign to the function. \n' +
				'If not supplied, Claudia will create a new role. Supply an ARN to create a function without any IAM access.',
			example:  'arn:aws:iam::123456789012:role/FileConverter'
		},
		{
			argument: 'runtime',
			optional: true,
			description: 'Node.js runtime to use. For supported values, see\n http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html',
			default: 'node4.3'
		},
		{
			argument: 'description',
			optional: true,
			description: 'Textual description of the lambda function',
			default: 'the project description from package.json'
		},
		{
			argument: 'memory',
			optional: true,
			description: 'The amount of memory, in MB, your Lambda function is given.\nThe value must be a multiple of 64 MB.',
			default: 128
		},
		{
			argument: 'timeout',
			optional: true,
			description: 'The function execution time, in seconds, at which AWS Lambda should terminate the function',
			default: 3
		},
		{
			argument: 'no-optional-dependencies',
			optional: true,
			description: 'Do not upload optional dependencies to Lambda.'
		},
		{
			argument: 'use-local-dependencies',
			optional: true,
			description: 'Do not install dependencies, use local node_modules directory instead'
		},
		{
			argument: 'cache-api-config',
			optional: true,
			example: 'claudiaConfigCache',
			description: 'Name of the stage variable for storing the current API configuration signature.\n' +
				'If set, it will also be used to check if the previously deployed configuration can be re-used and speed up deployment'
		},
		{
			argument: 'keep',
			optional: true,
			description: 'keep the produced package archive on disk for troubleshooting purposes.\n' +
				'If not set, the temporary files will be removed after the Lambda function is successfully created'
		},
		{
			argument: 'use-s3-bucket',
			optional: true,
			example: 'claudia-uploads',
			description: 'The name of a S3 bucket that Claudia will use to upload the function code before installing in Lambda.\n' +
				'You can use this to upload large functions over slower connections more reliably, and to leave a binary artifact\n' +
				'after uploads for auditing purposes. If not set, the archive will be uploaded directly to Lambda'
		},
		{
			argument: 'aws-delay',
			optional: true,
			example: '3000',
			description: 'number of milliseconds betweeen retrying AWS operations if they fail',
			default: '5000'
		},
		{
			argument: 'aws-retries',
			optional: true,
			example: '15',
			description: 'number of times to retry AWS operations if they fail',
			default: '15'
		},
		{
			argument: 'security-group-ids',
			optional: true,
			example: 'sg-1234abcd',
			description: 'A comma-delimited list of AWS VPC Security Group IDs, which the function will be able to access.\n' +
				'Note: these security groups need to be part of the same VPC as the subnets provided with --subnet-ids.'
		},
		{
			argument: 'subnet-ids',
			optional: true,
			example: 'subnet-1234abcd,subnet-abcd4567',
			description: 'A comma-delimited list of AWS VPC Subnet IDs, which this function should be able to access.\n' +
				'At least one subnet is required if you are using VPC access.\n' +
				'Note: these subnets need to be part of the same VPC as the security groups provided with --security-group-ids.'
		},
		{
			argument: 'set-env',
			optional: true,
			example: 'S3BUCKET=testbucket,SNSQUEUE=testqueue',
			description: 'comma-separated list of VAR=VALUE environment variables to set'
		},
		{
			argument: 'set-env-from-json',
			optional: true,
			example: 'production-env.json',
			description: 'file path to a JSON file containing environment variables to set'
		},
		{
			argument: 'env-kms-key-arn',
			optional: true,
			description: 'KMS Key ARN to encrypt/decrypt environment variables'
		}
	]
};
