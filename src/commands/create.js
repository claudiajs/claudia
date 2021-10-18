const path = require('path'),
	limits = require('../util/limits.json'),
	fsUtil = require('../util/fs-util'),
	aws = require('aws-sdk'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	cleanUpPackage = require('../tasks/clean-up-package'),
	addPolicy = require('../tasks/add-policy'),
	markAlias = require('../tasks/mark-alias'),
	validatePackage = require('../tasks/validate-package'),
	retriableWrap = require('../util/retriable-wrap'),
	loggingWrap = require('../util/logging-wrap'),
	deployProxyApi = require('../tasks/deploy-proxy-api'),
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	readjson = require('../util/readjson'),
	apiGWUrl = require('../util/apigw-url'),
	lambdaNameSanitize = require('../util/lambda-name-sanitize'),
	retry = require('oh-no-i-insist'),
	fs = require('fs'),
	fsPromise = require('../util/fs-promise'),
	os = require('os'),
	isRoleArn = require('../util/is-role-arn'),
	lambdaCode = require('../tasks/lambda-code'),
	initEnvVarsFromOptions = require('../util/init-env-vars-from-options'),
	getOwnerInfo = require('../tasks/get-owner-info'),
	executorPolicy = require('../policies/lambda-executor-policy'),
	loggingPolicy = require('../policies/logging-policy'),
	vpcPolicy = require('../policies/vpc-policy'),
	snsPublishPolicy = require('../policies/sns-publish-policy'),
	isSNSArn = require('../util/is-sns-arn'),
	lambdaInvocationPolicy = require('../policies/lambda-invocation-policy'),
	waitUntilNotPending = require('../tasks/wait-until-not-pending'),
	NullLogger = require('../util/null-logger');
module.exports = function create(options, optionalLogger) {
	'use strict';
	let roleMetadata,
		s3Key,
		packageArchive,
		functionDesc,
		customEnvVars,
		functionName,
		workingDir,
		ownerAccount,
		awsPartition,
		packageFileDir;
	const logger = optionalLogger || new NullLogger(),
		awsDelay = options && options['aws-delay'] && parseInt(options['aws-delay'], 10) || (process.env.AWS_DELAY && parseInt(process.env.AWS_DELAY, 10)) || 5000,
		awsRetries = options && options['aws-retries'] && parseInt(options['aws-retries'], 10) || 15,
		source = (options && options.source) || process.cwd(),
		configFile = (options && options.config) || path.join(source, 'claudia.json'),
		iam = loggingWrap(new aws.IAM({region: options.region}), {log: logger.logApiCall, logName: 'iam'}),
		lambda = loggingWrap(new aws.Lambda({region: options.region}), {log: logger.logApiCall, logName: 'lambda'}),
		s3 = loggingWrap(new aws.S3({region: options.region, signatureVersion: 'v4'}), {log: logger.logApiCall, logName: 's3'}),
		getSnsDLQTopic = function () {
			const topicNameOrArn = options['dlq-sns'];
			if (!topicNameOrArn) {
				return false;
			}
			if (isSNSArn(topicNameOrArn)) {
				return topicNameOrArn;
			}
			return `arn:${awsPartition}:sns:${options.region}:${ownerAccount}:${topicNameOrArn}`;
		},
		apiGatewayPromise = retriableWrap(
			loggingWrap(new aws.APIGateway({region: options.region}), {log: logger.logApiCall, logName: 'apigateway'}),
			() => logger.logStage('rate-limited by AWS, waiting before retry')
		),
		policyFiles = function () {
			let files = fsUtil.recursiveList(options.policies);
			if (fsUtil.isDir(options.policies)) {
				files = files.map(filePath => path.join(options.policies, filePath));
			}
			return files.filter(fsUtil.isFile);
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
			if (options['binary-media-types'] && !options['deploy-proxy-api']) {
				return 'binary-media-types only works with --deploy-proxy-api';
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
			if (!fsUtil.isDir(path.dirname(configFile))) {
				return 'cannot write to ' + configFile;
			}
			if (fsUtil.fileExists(configFile)) {
				if (options && options.config) {
					return options.config + ' already exists';
				}
				return 'claudia.json already exists in the source folder';
			}
			if (!fsUtil.fileExists(path.join(source, 'package.json'))) {
				return 'package.json does not exist in the source folder';
			}
			if (options.policies && !policyFiles().length) {
				return 'no files match additional policies (' + options.policies + ')';
			}
			if (options.memory || options.memory === 0) {
				if (options.memory < limits.LAMBDA.MEMORY.MIN) {
					return `the memory value provided must be greater than or equal to ${limits.LAMBDA.MEMORY.MIN}`;
				}
				if (options.memory > limits.LAMBDA.MEMORY.MAX) {
					return `the memory value provided must be less than or equal to ${limits.LAMBDA.MEMORY.MAX}`;
				}
				if (options.memory % 64 !== 0) {
					return 'the memory value provided must be a multiple of 64';
				}
			}
			if (options.timeout || options.timeout === 0) {
				if (options.timeout < 1) {
					return 'the timeout value provided must be greater than or equal to 1';
				}
				if (options.timeout > 900) {
					return 'the timeout value provided must be less than or equal to 900';
				}
			}
			if (options['allow-recursion'] && options.role && isRoleArn(options.role)) {
				return 'incompatible arguments allow-recursion and role. When specifying a role ARN, Claudia does not patch IAM policies.';
			}
			if (options['s3-key'] && !options['use-s3-bucket']) {
				return '--s3-key only works with --use-s3-bucket';
			}
			if (options.arch && options.arch !== 'x86_64' && options.arch !== 'arm64') {
				return '--arch should specify either \'x86_64\' or \'arm64\'';
			}
		},
		getPackageInfo = function () {
			logger.logStage('loading package config');
			return readjson(path.join(source, 'package.json'))
			.then(jsonConfig => {
				const name = options.name || lambdaNameSanitize(jsonConfig.name),
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
				() => {
					logger.logStage('creating Lambda');
					return lambda.createFunction({
						Architectures: [options.arch || 'x86_64'],
						Code: functionCode,
						FunctionName: functionName,
						Description: functionDesc,
						MemorySize: options.memory,
						Timeout: options.timeout,
						Environment: customEnvVars,
						KMSKeyArn: options['env-kms-key-arn'],
						Handler: options.handler || (options['api-module'] + '.proxyRouter'),
						Role: roleArn,
						Runtime: options.runtime || 'nodejs14.x',
						Publish: true,
						Layers: options.layers && options.layers.split(','),
						VpcConfig: options['security-group-ids'] && options['subnet-ids'] && {
							SecurityGroupIds: (options['security-group-ids'] && options['security-group-ids'].split(',')),
							SubnetIds: (options['subnet-ids'] && options['subnet-ids'].split(','))
						},
						DeadLetterConfig: getSnsDLQTopic() ? {
							TargetArn: getSnsDLQTopic()
						} : null
					}).promise();
				},
				awsDelay, awsRetries,
				error => {
					return error &&
						error.code === 'InvalidParameterValueException' &&
						(error.message === 'The role defined for the function cannot be assumed by Lambda.'
						|| error.message.startsWith('The provided execution role does not have permissions')
						|| error.message.startsWith('Lambda was unable to configure access to your environment variables because the KMS key is invalid for CreateGrant.')
						);
				},
				() => logger.logStage('waiting for IAM role propagation'),
				Promise
			);
		},
		markAliases = function (lambdaData) {
			logger.logStage('creating version alias');
			return markAlias(lambdaData.FunctionName, lambda, '$LATEST', 'latest')
			.then(() => {
				if (options.version) {
					return markAlias(lambdaData.FunctionName, lambda, lambdaData.Version, options.version);
				}
			})
			.then(() =>lambdaData);
		},
		waitForState = function (lambdaData) {
			logger.logStage('waiting for lambda resource allocation');
			return waitUntilNotPending(lambda, lambdaData.FunctionName, awsDelay, awsRetries)
			.then(() => lambdaData);
		},
		createWebApi = function (lambdaMetadata, packageDir) {
			let apiModule, apiConfig, apiModulePath;
			const alias = options.version || 'latest';
			logger.logStage('creating REST API');
			try {
				apiModulePath = path.join(packageDir, options['api-module']);
				apiModule = require(path.resolve(apiModulePath));
				apiConfig = apiModule && apiModule.apiConfig && apiModule.apiConfig();
			} catch (e) {
				console.error(e.stack || e);
				return Promise.reject(`cannot load api config from ${apiModulePath}`);
			}

			if (!apiConfig) {
				return Promise.reject(`No apiConfig defined on module '${options['api-module']}'. Are you missing a module.exports?`);
			}
			return apiGatewayPromise.createRestApiPromise({
				name: lambdaMetadata.FunctionName
			})
			.then((result) => {
				lambdaMetadata.api = {
					id: result.id,
					module: options['api-module'],
					url: apiGWUrl(result.id, options.region, alias)
				};
				return rebuildWebApi(lambdaMetadata.FunctionName, alias, result.id, apiConfig, ownerAccount, awsPartition, options.region, logger, options['cache-api-config']);
			})
			.then(() => {
				if (apiModule.postDeploy) {
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
							aws: aws
						}
					);
				}
			})
			.then(postDeployResult => {
				if (postDeployResult) {
					lambdaMetadata.api.deploy = postDeployResult;
				}
				return lambdaMetadata;
			});
		},
		saveConfig = function (lambdaMetaData) {
			const config = {
				lambda: {
					role: roleMetadata.Role.RoleName,
					name: lambdaMetaData.FunctionName,
					region: options.region
				}
			};
			if (options.role) {
				config.lambda.sharedRole = true;
			}
			logger.logStage('saving configuration');
			if (lambdaMetaData.api) {
				config.api =  { id: lambdaMetaData.api.id, module: lambdaMetaData.api.module };
			}
			return fsPromise.writeFileAsync(
				configFile,
				JSON.stringify(config, null, 2),
				'utf8'
			)
			.then(() => lambdaMetaData);
		},
		formatResult = function (lambdaMetaData) {
			const config = {
				lambda: {
					role: roleMetadata.Role.RoleName,
					name: lambdaMetaData.FunctionName,
					region: options.region
				}
			};
			if (options.role) {
				config.lambda.sharedRole = true;
			}
			if (lambdaMetaData.api) {
				config.api =  lambdaMetaData.api;
			}
			if (s3Key) {
				config.s3key = s3Key;
			}
			return config;
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
				return iam.createRole({
					RoleName: functionName + '-executor',
					AssumeRolePolicyDocument: executorPolicy()
				}).promise();
			}
		},
		addExtraPolicies = function () {
			return Promise.all(policyFiles().map(fileName => {
				const policyName = path.basename(fileName).replace(/[^A-z0-9]/g, '-');
				return addPolicy(iam, policyName, roleMetadata.Role.RoleName, fileName);
			}));
		},
		cleanup = function (result) {
			if (!options.keep) {
				fsUtil.rmDir(workingDir);
				fs.unlinkSync(packageArchive);
			} else {
				result.archive = packageArchive;
			}
			return result;
		};
	if (validationError()) {
		return Promise.reject(validationError());
	}
	return initEnvVarsFromOptions(options)
	.then(opts => customEnvVars = opts)
	.then(getPackageInfo)
	.then(packageInfo => {
		functionName = packageInfo.name;
		functionDesc = packageInfo.description;
	})
	.then(() => getOwnerInfo(options.region, logger))
	.then(ownerInfo => {
		ownerAccount = ownerInfo.account;
		awsPartition = ownerInfo.partition;
	})
	.then(() => fsPromise.mkdtempAsync(os.tmpdir() + path.sep))
	.then(dir => workingDir = dir)
	.then(() => collectFiles(source, workingDir, options, logger))
	.then(dir => {
		logger.logStage('validating package');
		return validatePackage(dir, options.handler, options['api-module']);
	})
	.then(dir => {
		packageFileDir = dir;
		return cleanUpPackage(dir, options, logger);
	})
	.then(dir => {
		logger.logStage('zipping package');
		return zipdir(dir);
	})
	.then(zipFile => {
		packageArchive = zipFile;
	})
	.then(() => loadRole(functionName))
	.then((result) => {
		roleMetadata = result;
	})
	.then(() => {
		if (!options.role) {
			return iam.putRolePolicy({
				RoleName: roleMetadata.Role.RoleName,
				PolicyName: 'log-writer',
				PolicyDocument: loggingPolicy(awsPartition)
			}).promise()
			.then(() => {
				if (getSnsDLQTopic()) {
					return iam.putRolePolicy({
						RoleName: roleMetadata.Role.RoleName,
						PolicyName: 'dlq-publisher',
						PolicyDocument: snsPublishPolicy(getSnsDLQTopic())
					}).promise();
				}
			});
		}
	})
	.then(() => {
		if (options.policies) {
			return addExtraPolicies();
		}
	})
	.then(() => {
		if (options['security-group-ids'] && !isRoleArn(options.role)) {
			return iam.putRolePolicy({
				RoleName: roleMetadata.Role.RoleName,
				PolicyName: 'vpc-access-execution',
				PolicyDocument: vpcPolicy()
			}).promise();
		}
	})
	.then(() => {
		if (options['allow-recursion']) {
			return iam.putRolePolicy({
				RoleName: roleMetadata.Role.RoleName,
				PolicyName: 'recursive-execution',
				PolicyDocument: lambdaInvocationPolicy(functionName, awsPartition, options.region)
			}).promise();
		}
	})
	.then(() => lambdaCode(s3, packageArchive, options['use-s3-bucket'], options['s3-sse'], options['s3-key']))
	.then(functionCode => {
		s3Key = functionCode.S3Key;
		return createLambda(functionName, functionDesc, functionCode, roleMetadata.Role.Arn);
	})
	.then(waitForState)
	.then(markAliases)
	.then(lambdaMetadata => {
		if (options['api-module']) {
			return createWebApi(lambdaMetadata, packageFileDir);
		} else if (options['deploy-proxy-api']) {
			return deployProxyApi(lambdaMetadata, options, ownerAccount, awsPartition, apiGatewayPromise, logger);
		} else {
			return lambdaMetadata;
		}
	})
	.then(saveConfig)
	.then(formatResult)
	.then(cleanup);
};

module.exports.doc = {
	description: 'Create the initial lambda function and related security role.',
	priority: 1,
	args: [
		{
			argument: 'region',
			description: 'AWS region where to create the lambda. For supported values, see\n https://docs.aws.amazon.com/general/latest/gr/rande.html#lambda_region',
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
			argument: 'arch',
			optional: true,
			description: 'Specifies the desired architecture, either x86_64 or arm64. \n' +
				'If a value is not provided, x86_64 will be used as the default.',
			default: 'x86_64',
			since: '5.13.2'
		},
		{
			argument: 'deploy-proxy-api',
			optional: true,
			description: 'If specified, a proxy API will be created for the Lambda \n' +
				' function on API Gateway, and forward all requests to function. \n' +
				' This is an alternative way to create web APIs to --api-module.'
		},
		{
			argument: 'binary-media-types',
			optional: true,
			description: 'A comma-delimited list of binary-media-types to \n' +
				'set when using --deploy-proxy-api. Use an empty string in quotes \n' +
				'to not set any binary media types.',
			example: 'image/png,image/jpeg',
			'default': '*/*'
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
			example: 'policies/*.json'
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
			example: 'arn:aws:iam::123456789012:role/FileConverter'
		},
		{
			argument: 'runtime',
			optional: true,
			description: 'Node.js runtime to use. For supported values, see\n http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html',
			default: 'nodejs14.x'
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
			argument: 'npm-options',
			optional: true,
			description: 'Any additional options to pass on to NPM when installing packages. Check https://docs.npmjs.com/cli/install for more information',
			example: '--ignore-scripts',
			since: '5.0.0'
		},
		{
			argument: 'cache-api-config',
			optional: true,
			example: 'claudiaConfigCache',
			description: 'Name of the stage variable for storing the current API configuration signature.\n' +
				'If set, it will also be used to check if the previously deployed configuration can be re-used and speed up deployment'
		},
		{
			argument: 'post-package-script',
			optional: true,
			example: 'customNpmScript',
			description: 'the name of a NPM script to execute custom processing after claudia finished packaging your files.\n' +
				'Note that development dependencies are not available at this point, but you can use npm uninstall to remove utility tools as part of this step.',
			since: '5.0.0'
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
			'after uploads for auditing purposes. If not set, the archive will be uploaded directly to Lambda.\n'
		},
		{
			argument: 's3-key',
			optional: true,
			example: 'path/to/file.zip',
			description: 'The key to which the function code will be uploaded in the s3 bucket referenced in `--use-s3-bucket`'
		},
		{
			argument: 's3-sse',
			optional: true,
			example: 'AES256',
			description: 'The type of Server Side Encryption applied to the S3 bucket referenced in `--use-s3-bucket`'
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
		},
		{
			argument: 'layers',
			optional: true,
			description: 'A comma-delimited list of Lambda layers to attach to this function',
			example: 'arn:aws:lambda:us-east-1:12345678:layer:ffmpeg:4'
		},
		{
			argument: 'dlq-sns',
			optional: true,
			description: 'Dead letter queue SNS topic name or ARN',
			example: 'arn:aws:sns:us-east-1:123456789012:my_corporate_topic'
		}
	]
};
