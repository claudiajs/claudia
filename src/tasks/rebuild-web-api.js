/*global module, require */
var aws = require('aws-sdk'),
	Promise = require('bluebird'),
	validAuthType = require('../util/valid-auth-type'),
	validCredentials = require('../util/valid-credentials'),
	allowApiInvocation = require('./allow-api-invocation'),
	pathSplitter = require('../util/path-splitter'),
	promiseWrap = require('../util/promise-wrap'),
	retriableWrap = require('../util/retriable-wrap'),
	NullLogger = require('../util/null-logger'),
	safeHash = require('../util/safe-hash'),
	getOwnerId = require('./get-owner-account-id'),
	registerAuthorizers = require('./register-authorizers');
module.exports = function rebuildWebApi(functionName, functionVersion, restApiId, apiConfig, awsRegion, optionalLogger, configCacheStageVar) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		apiGateway = retriableWrap(
						promiseWrap(
							new aws.APIGateway({region: awsRegion}),
							{log: logger.logApiCall, logName: 'apigateway', suffix: 'Async'}
						),
						function () {
							logger.logApiCall('rate-limited by AWS, waiting before retry');
						},
						/Async$/
						),
		configHash = safeHash(apiConfig),
		existingResources,
		ownerId,
		knownIds = {},
		authorizerIds,
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
		findRoot = function () {
			var rootResource = findByPath(existingResources, '/');
			knownIds[''] = rootResource.id;
			return rootResource.id;
		},
		supportsCors = function () {
			return (apiConfig.corsHandlers !== false);
		},
		putMockIntegration = function (resourceId, httpMethod) {
			return apiGateway.putIntegrationAsync({
				restApiId: restApiId,
				resourceId: resourceId,
				httpMethod: httpMethod,
				type: 'MOCK',
				requestTemplates: {
					'application/json': '{\"statusCode\": 200}'
				}
			});
		},
		putLambdaIntegration = function (resourceId, methodName, credentials) {
			return apiGateway.putIntegrationAsync({
				restApiId: restApiId,
				resourceId: resourceId,
				httpMethod: methodName,
				credentials: credentials,
				type: 'AWS_PROXY',
				integrationHttpMethod: 'POST',
				uri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/arn:aws:lambda:' + awsRegion + ':' + ownerId + ':function:' + functionName + ':${stageVariables.lambdaVersion}/invocations'
			});
		},
		corsHeaderValue = function () {
			var val = apiConfig.corsHeaders || 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
			if (!supportsCors()) {
				return '';
			}
			return '\'' + val + '\'';
		},
		createMethod = function (methodName, resourceId, methodOptions) {
			var apiKeyRequired = function () {
					return methodOptions && methodOptions.apiKeyRequired;
				},
				authorizationType = function () {
					if (methodOptions && methodOptions.authorizationType && validAuthType(methodOptions.authorizationType.toUpperCase())) {
						return methodOptions.authorizationType.toUpperCase();
					} else if (methodOptions.customAuthorizer) {
						return 'CUSTOM';
					} else if (methodOptions && validCredentials(methodOptions.invokeWithCredentials)) {
						return 'AWS_IAM';
					} else {
						return 'NONE';
					}
				},
				credentials = function () {
					if (methodOptions && methodOptions.invokeWithCredentials) {
						if (methodOptions.invokeWithCredentials === true) {
							return 'arn:aws:iam::*:user/*';
						} else if (validCredentials(methodOptions.invokeWithCredentials)) {
							return methodOptions.invokeWithCredentials;
						}
					}
					return null;
				},
				addMethodResponse = function () {
					return apiGateway.putMethodResponseAsync({
						restApiId: restApiId,
						resourceId: resourceId,
						httpMethod: methodName,
						statusCode: '200'
					}).then(function () {
						return apiGateway.putIntegrationResponseAsync({
							restApiId: restApiId,
							resourceId: resourceId,
							httpMethod: methodName,
							statusCode: '200',
							responseTemplates: {
								'application/json': ''
							}
						});
					});
				},
				authorizerId = function () {
					return methodOptions && methodOptions.customAuthorizer && authorizerIds[methodOptions.customAuthorizer];
				};
			return apiGateway.putMethodAsync({
				authorizationType: authorizationType(),
				authorizerId: authorizerId(),
				httpMethod: methodName,
				resourceId: resourceId,
				restApiId: restApiId,
				apiKeyRequired: apiKeyRequired()
			}).then(function () {
				return putLambdaIntegration(resourceId, methodName, credentials());
			}).then(function () {
				return addMethodResponse();
			});
		},
		createCorsHandler = function (resourceId) {
			return apiGateway.putMethodAsync({
				authorizationType: 'NONE',
				httpMethod: 'OPTIONS',
				resourceId: resourceId,
				restApiId: restApiId
			}).then(function () {
				if (apiConfig.corsHandlers) {
					return putLambdaIntegration(resourceId, 'OPTIONS');
				} else {
					return putMockIntegration(resourceId, 'OPTIONS');
				}
			}).then(function () {
				var responseParams = null;
				if (!apiConfig.corsHandlers) {
					responseParams = {
						'method.response.header.Access-Control-Allow-Headers': false,
						'method.response.header.Access-Control-Allow-Methods': false,
						'method.response.header.Access-Control-Allow-Origin': false
					};
				}
				return apiGateway.putMethodResponseAsync({
					restApiId: restApiId,
					resourceId: resourceId,
					httpMethod: 'OPTIONS',
					statusCode: '200',
					responseModels: {
						'application/json': 'Empty'
					},
					responseParameters: responseParams
				});
			}).then(function () {
				var responseParams = null;

				if (!apiConfig.corsHandlers) {
					responseParams = {
						'method.response.header.Access-Control-Allow-Headers': corsHeaderValue(),
						'method.response.header.Access-Control-Allow-Methods': '\'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT\'',
						'method.response.header.Access-Control-Allow-Origin': '\'*\''
					};
				}
				return apiGateway.putIntegrationResponseAsync({
					restApiId: restApiId,
					resourceId: resourceId,
					httpMethod: 'OPTIONS',
					statusCode: '200',
					responseTemplates: {
						'application/json': ''
					},
					responseParameters: responseParams
				});
			});
		},
		findResourceByPath = function (path) {
			var pathComponents = pathSplitter(path);
			if (knownIds[path]) {
				return Promise.resolve(knownIds[path]);
			} else {
				return findResourceByPath(pathComponents.parentPath)
				.then(function (parentId) {
					return apiGateway.createResourceAsync({
						restApiId: restApiId,
						parentId: parentId,
						pathPart: pathComponents.pathPart
					});
				}).then(function (resource) {
					knownIds[path] = resource.id;
					return resource.id;
				});
			}
		},
		configurePath = function (path) {
			var resourceId,
				supportedMethods = Object.keys(apiConfig.routes[path]),
				createMethodMapper = function (methodName) {
					return createMethod(methodName, resourceId, apiConfig.routes[path][methodName]);
				};
			return findResourceByPath(path).then(function (r) {
				resourceId = r;
			}).then(function () {
				return Promise.map(supportedMethods, createMethodMapper, {concurrency: 1});
			}).then(function () {
				if (supportsCors()) {
					return createCorsHandler(resourceId);
				}
			});
		},
		dropMethods = function (resource) {
			var dropMethodMapper = function (method) {
				return apiGateway.deleteMethodAsync({
					resourceId: resource.id,
					restApiId: restApiId,
					httpMethod: method
				});
			};
			if (resource.resourceMethods) {
				return Promise.map(Object.keys(resource.resourceMethods), dropMethodMapper, {concurrency: 1});
			} else {
				return Promise.resolve();
			}
		},
		removeResource = function (resource) {
			if (resource.path !== '/') {
				return apiGateway.deleteResourceAsync({
					resourceId: resource.id,
					restApiId: restApiId
				});
			} else {
				return dropMethods(resource);
			}
		},
		dropSubresources = function () {
			var currentResource;
			if (existingResources.length === 0) {
				return Promise.resolve();
			} else {
				currentResource = existingResources.pop();
				return removeResource(currentResource).then(function () {
					if (existingResources.length > 0) {
						return dropSubresources();
					}
				});
			}
		},
		pathSort = function (resA, resB) {
			if (resA.path > resB.path) {
				return 1;
			} else if (resA.path === resB.path) {
				return 0;
			}
			return -1;
		},
		removeExistingResources = function () {
			return getExistingResources()
			.then(function (resources) {
				existingResources = resources.items;
				existingResources.sort(pathSort);
				return existingResources;
			}).then(findRoot)
			.then(dropSubresources);
		},
		rebuildApi = function () {
			return allowApiInvocation(functionName, functionVersion, restApiId, ownerId, awsRegion)
			.then(function () {
				return Promise.map(Object.keys(apiConfig.routes), configurePath, {concurrency: 1});
			});
		},
		deployApi = function () {
			var stageVars = {
				lambdaVersion: functionVersion
			};
			if (configCacheStageVar) {
				stageVars[configCacheStageVar] = configHash;
			}

			return apiGateway.createDeploymentAsync({
				restApiId: restApiId,
				stageName: functionVersion,
				variables: stageVars
			});
		},
		configureAuthorizers = function () {
			if (apiConfig.authorizers && apiConfig.authorizers !== {}) {
				return registerAuthorizers(apiConfig.authorizers, restApiId, awsRegion, functionVersion, logger).then(function (result) {
					authorizerIds = result;
				});
			} else {
				authorizerIds = {};
			}
		},
		uploadApiConfig = function () {
			return removeExistingResources()
				.then(configureAuthorizers)
				.then(rebuildApi)
				.then(deployApi);
		},
		getExistingConfigHash = function () {
			if (!configCacheStageVar) {
				return false;
			}
			return apiGateway.getStageAsync({
				restApiId: restApiId,
				stageName: functionVersion
			}).then(function (stage) {
				return stage.variables && stage.variables[configCacheStageVar];
			}).catch(function () {
				return false;
			});

		};
	return getOwnerId(logger).then(function (accountOwnerId) {
			ownerId = accountOwnerId;
		})
		.then(getExistingConfigHash)
		.then(function (existingHash) {
			if (existingHash && existingHash === configHash) {
				logger.logStage('Reusing cached API configuration');
			} else {
				return uploadApiConfig();
			}
		});

};
