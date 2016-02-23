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
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	fs = Promise.promisifyAll(require('fs'));
module.exports = function create(options) {
	'use strict';
	var source = options.source || shell.pwd(),
		iam = Promise.promisifyAll(new aws.IAM()),
		lambda = Promise.promisifyAll(new aws.Lambda({region: options.region}), {suffix: 'Promise'}),
		roleMetadata,
		validationError = function () {
			if (!options.name) {
				return 'project name is missing. please specify with --name';
			}
			if (!options.region) {
				return 'AWS region is missing. please specify with --region';
			}
			if (!options.handler && !options['api-module']) {
				return 'Lambda handler is missing. please specify with --handler';
			}
			if (shell.test('-e', path.join(source, 'claudia.json'))) {
				return 'claudia.json already exists in the source folder';
			}
			if (!shell.test('-e', path.join(source, 'package.json'))) {
				return 'package.json does not exist in the source folder';
			}
		},
		createLambda = function (zipFile, roleArn, retriesLeft) {
			var functionMeta = {
				Code: { ZipFile: zipFile },
				FunctionName: options.name,
				Handler: options.handler || (options['api-module'] + '.router'),
				Role: roleArn,
				Runtime: 'nodejs',
				Publish: true
			},
			lambdaData,
			iamPropagationError = 'The role defined for the function cannot be assumed by Lambda.';
			if (!retriesLeft) {
				return Promise.reject('Timeout waiting for AWS IAM to propagate role');
			}
			return lambda.createFunctionPromise(functionMeta).catch(function (error) {
				if (error && error.cause && error.cause.message == iamPropagationError) {
					return Promise.delay(2000).then(function () {
						return createLambda(zipFile, roleArn, retriesLeft - 1);
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
				apiConfig = apiModule.apiConfig(),
				apiGateway = Promise.promisifyAll(new aws.APIGateway({region: options.region}));
			return apiGateway.createRestApiAsync({
				name: options.name
			}).then(function (result) {
				lambdaMetadata.api = {id: result.id, module: options['api-module']};
				return rebuildWebApi(lambdaMetadata.FunctionName, options.version || 'latest', result.id, apiConfig, options.region);
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
				config.api = lambdaMetaData.api;
			}
			return fs.writeFileAsync(
				path.join(source, 'claudia.json'),
				JSON.stringify(config, null, 2),
				'utf8'
			).then(function () {
				return config;
			});
		},
		loadRole = function () {
			if (options.role) {
				return iam.getRoleAsync({RoleName: options.role});
			} else {
				return fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
					.then(function (lambdaRolePolicy) {
						return iam.createRoleAsync({
							RoleName: options.name + '-executor',
							AssumeRolePolicyDocument: lambdaRolePolicy
						});
					});
			}
		};
	if (validationError()) {
		return Promise.reject(validationError());
	}
	return loadRole()
	.then(function (result) {
		roleMetadata = result;
	}).then(function () {
		return addPolicy('log-writer', options.name + '-executor');
	}).then(function () {
		return collectFiles(source);
	}).then(zipdir)
	.then(fs.readFileAsync)
	.then(function (fileContents) {
		return createLambda(fileContents, roleMetadata.Role.Arn, 10);
	})
	.then(function (lambdaMetadata) {
		if (options['api-module']) {
			return createWebApi(lambdaMetadata);
		} else {
			return lambdaMetadata;
		}
	})
	.then(saveConfig);
};
