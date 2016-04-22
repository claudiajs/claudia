/*global module, require */
var Promise = require('bluebird'),
	path = require('path'),
	shell = require('shelljs'),
	aws = require('aws-sdk'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	addPolicy = require('../tasks/add-policy'),
	markAlias = require('../tasks/mark-alias'),
	templateFile = require('../util/template-file'),
	validatePackage = require('../tasks/validate-package'),
	retriableWrap = require('../util/wrap'),
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	readjson = require('../util/readjson'),
	apiGWUrl = require('../util/apigw-url'),
	fs = Promise.promisifyAll(require('fs'));
module.exports = function create(options) {
	'use strict';
	var source = (options && options.source) || shell.pwd(),
		configFile = (options && options.config) || path.join(source, 'claudia.json'),
		iam = Promise.promisifyAll(new aws.IAM()),
		lambda = Promise.promisifyAll(new aws.Lambda({region: options.region}), {suffix: 'Promise'}),
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
			if (!options.region) {
				return 'AWS region is missing. please specify with --region';
			}
			if (!options.handler && !options['api-module']) {
				return 'Lambda handler is missing. please specify with --handler';
			}
			if (options.handler && options.handler.indexOf('/') >= 0) {
				return 'Lambda handler module has to be in the main project directory';
			}
			if (options['api-module'] && options['api-module'].indexOf('/') >= 0) {
				return 'API module has to be in the main project directory';
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
		},
		getPackageNameAndDesciption = function () {
			return readjson(path.join(source, 'package.json')).then(function (jsonConfig) {
				var name = options.name || (jsonConfig.name && jsonConfig.name.trim()),
				    description = jsonConfig.description && jsonConfig.description.trim();
				if (!name) {
					return Promise.reject('project name is missing. please specify with --name or in package.json');
				}
				return {
					name: name,
					description: description
				};
			});
		},
		createLambda = function (functionName, functionDesc, zipFile, roleArn, retriesLeft) {
			var functionMeta = {
				Code: { ZipFile: zipFile },
				FunctionName: functionName,
				Description: functionDesc,
				Handler: options.handler || (options['api-module'] + '.router'),
				Role: roleArn,
				Runtime: options.runtime || 'nodejs4.3',
				Publish: true
			},
			lambdaData,
			iamPropagationError = 'The role defined for the function cannot be assumed by Lambda.';
			if (!retriesLeft) {
				return Promise.reject('Timeout waiting for AWS IAM to propagate role');
			}
			return lambda.createFunctionPromise(functionMeta).catch(function (error) {
				if (error && error.cause && error.cause.message == iamPropagationError) {
					return Promise.delay(3000).then(function () {
						return createLambda(functionName, functionDesc, zipFile, roleArn, retriesLeft - 1);
					});
				} else {
					return Promise.reject(error);
				}
			}).then(function (creationResult) {
				lambdaData = creationResult;
			}).then(function () {
				return markAlias(lambdaData.FunctionName, options.region, '$LATEST', 'latest');
			}).then(function () {
				if (options.version) {
					return markAlias(lambdaData.FunctionName, options.region, lambdaData.Version, options.version);
				}
			}).then(function () {
				return lambdaData;
			});
		},
		createWebApi = function (lambdaMetadata) {
			var apiModule = require(path.join(options.source, options['api-module'])),
				apiGateway = retriableWrap('apiGateway', Promise.promisifyAll(new aws.APIGateway({region: options.region}))),
				apiConfig = apiModule && apiModule.apiConfig && apiModule.apiConfig();
			if (!apiConfig) {
				return Promise.reject('No apiConfig defined on module \'' + options['api-module'] + '\'. Are you missing a module.exports?');
			}
			return apiGateway.createRestApiAsync({
				name: lambdaMetadata.FunctionName
			}).then(function (result) {
				var alias = options.version || 'latest';
				lambdaMetadata.api = {
					id: result.id,
					module: options['api-module'],
					url: apiGWUrl(result.id, options.region, alias)
				};
				return rebuildWebApi(lambdaMetadata.FunctionName, alias, result.id, apiConfig, options.region, options.verbose);
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
			return config;
		},
		loadRole = function (functionName) {
			if (options.role) {
				return iam.getRoleAsync({RoleName: options.role});
			} else {
				return fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
					.then(function (lambdaRolePolicy) {
						return iam.createRoleAsync({
							RoleName: functionName + '-executor',
							AssumeRolePolicyDocument: lambdaRolePolicy
						});
					});
			}
		},
		addExtraPolicies = function () {
			return Promise.map(policyFiles(), function (fileName) {
				var policyName = path.basename(fileName).replace(/[^A-z0-9]/g, '-');
				return addPolicy(policyName, roleMetadata.Role.RoleName, fileName);
			});
		},
		packageArchive,
		functionDesc,
		functionName;
	if (validationError()) {
		return Promise.reject(validationError());
	}
	return getPackageNameAndDesciption().then(function (nameAndDesc) {
		functionName = nameAndDesc.name;
		functionDesc = nameAndDesc.description;
	}).then(function () {
		return collectFiles(source);
	}).then(function (dir) {
		return validatePackage(dir, options.handler, options['api-module']);
	}).then(zipdir).then(function (zipFile) {
		packageArchive = zipFile;
	}).then(function () {
		return loadRole(functionName);
	}).then(function (result) {
		roleMetadata = result;
	}).then(function () {
		return addPolicy('log-writer', roleMetadata.Role.RoleName);
	}).then(function () {
		if (options.policies) {
			return addExtraPolicies();
		}
	}).then(function () {
		return fs.readFileAsync(packageArchive);
	}).then(function (fileContents) {
		return createLambda(functionName, functionDesc, fileContents, roleMetadata.Role.Arn, 10);
	})
	.then(function (lambdaMetadata) {
		if (options['api-module']) {
			return createWebApi(lambdaMetadata);
		} else {
			return lambdaMetadata;
		}
	})
	.then(saveConfig).then(formatResult);
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
				'If you provide this parameter, the handler option is ignored.\n' +
				'This should be a module created using the Claudia API Builder.',
			example: 'if the api is defined in web.js, this would be web'
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
			argument: 'role',
			optional: true,
			description: 'The name of an existing role to assign to the function. \n' +
				'If not supplied, Claudia will create a new role'
		},
		{
			argument: 'runtime',
			optional: true,
			description: 'Node.js runtime to use. For supported values, see\n http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html',
			default: 'node4.3'
		}
	]
};
