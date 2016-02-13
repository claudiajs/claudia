/*global module, require, __dirname*/
var Promise = require('bluebird'),
	path = require('path'),
	shell = require('shelljs'),
	aws = require('aws-sdk'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	addPolicy = require('../tasks/add-policy'),
	markAlias = require('../tasks/mark-alias'),
	fs = Promise.promisifyAll(require('fs'));
module.exports = function create(options) {
	'use strict';
	var source = options.source || shell.pwd(),
		iam = Promise.promisifyAll(new aws.IAM()),
		lambda = Promise.promisifyAll(new aws.Lambda({region: options.region}), {suffix: 'Promise'}),
		createFunction = Promise.promisify(lambda.createFunction.bind(lambda)),
		roleMetadata,
		templateFile = function (fileName) {
			return path.join(__dirname, '..', '..', 'json-templates', fileName);
		},
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
			return createFunction(functionMeta).catch(function (error) {
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
				if (options.version) {
					return markAlias(lambdaData.FunctionName, options.region, lambdaData.Version, options.version);
				}
			}).then(function () {
				//TODO: replace FunctionArn with Alias ARN
				return lambdaData;
			});
		},
		createWebApi = function (lambdaMetaData) {
			var apiModule = require(path.join(options.source, options['api-module'])),
				apiConfig = apiModule.apiConfig(),
				apiGateway = Promise.promisifyAll(new aws.APIGateway({region: options.region})),
				existingResources,
				rootResourceId,
				paramsInputTemplate,
				restApiId,
				allowApiInvocation = function () {
					return iam.getUserAsync().then(function (result) {
						return lambda.addPermissionPromise({
							Action: 'lambda:InvokeFunction',
							FunctionName: lambdaMetaData.FunctionName,
							Principal: 'apigateway.amazonaws.com',
							SourceArn: 'arn:aws:execute-api:' + options.region + ':' + result.User.UserId + ':' + restApiId + '/*/*/*',
							Qualifier: options.version,
							StatementId: 'web-api-access'
						});
					});
				},
				findByPath = function (resourceItems, path) {
					var result;
					resourceItems.forEach(function (item) {
						if (item.path === path) {
							result = item;
						}
					});
					return result;
				},
				getExistingResources = function () {
					return apiGateway.getResourcesAsync({restApiId: restApiId, limit: 499});
				},
				findRoot = function (resourceItems) {
					rootResourceId = findByPath(resourceItems, '/').id;
					return rootResourceId;
				},
				createPath = function (path) {
					return apiGateway.createResourceAsync({
						restApiId: restApiId,
						parentId: rootResourceId,
						pathPart: path
					}).then(function (resource) {
						var createMethod = function (methodName) {
							return apiGateway.putMethodAsync({
								authorizationType: 'NONE', /*todo support config */
								httpMethod: methodName,
								resourceId: resource.id,
								restApiId: restApiId
							}).then(function () {
								return apiGateway.putIntegrationAsync({
									restApiId: restApiId,
									resourceId: resource.id,
									httpMethod: methodName,
									type: 'AWS',
									integrationHttpMethod: 'POST',
									requestTemplates: {
										'application/json': paramsInputTemplate
									},
									uri: 'arn:aws:apigateway:' + options.region + ':lambda:path/2015-03-31/functions/' + lambdaMetaData.FunctionArn + '/invocations'
								});
							}).then(function () {
								return apiGateway.putMethodResponseAsync({
									restApiId: restApiId,
									resourceId: resource.id,
									httpMethod: methodName,
									statusCode: '200',
									responseModels: {
										'application/json': 'Empty'
									}
								});
							}).then(function () {
								return apiGateway.putIntegrationResponseAsync({
									restApiId: restApiId,
									resourceId: resource.id,
									httpMethod: methodName,
									statusCode: '200',
									responseTemplates: {
										'application/json': ''
									}
								});
							});
						};
						return Promise.map(apiConfig[path].methods, createMethod, {concurrency: 1});
					});
				};
			return fs.readFileAsync(templateFile('apigw-params-input.txt'), 'utf8').then(function (content) {
				paramsInputTemplate = content;
			}).then(function () {
				return apiGateway.createRestApiAsync({
					name: options.name
				});
			}).then(function (result) {
				restApiId = result.id;
			}).then(allowApiInvocation)
			.then(getExistingResources)
			.then(function (resources) {
				existingResources = resources.items;
				return existingResources;
			})
			.then(findRoot)
			.then(function () {
				return Promise.map(Object.keys(apiConfig), createPath, {concurrency: 1});
			}).then(function () {
				lambdaMetaData.apiId = restApiId;
				return lambdaMetaData;
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
			if (lambdaMetaData.apiId) {
				config.api = {
					id: lambdaMetaData.apiId
				};
			}
			return fs.writeFileAsync(
				path.join(source, 'claudia.json'),
				JSON.stringify(config, null, 2),
				'utf8'
			).then(function () {
				return config;
			});
		};
	if (validationError()) {
		return Promise.reject(validationError());
	}
	return fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
	.then(function (lambdaRolePolicy) {
		return iam.createRoleAsync({
			RoleName: options.name + '-executor',
			AssumeRolePolicyDocument: lambdaRolePolicy
		});
	}).then(function (result) {
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
