/*global module, require, Promise */
var aws = require('aws-sdk'),
	validAuthType = require('../util/valid-auth-type'),
	sequentialPromiseMap = require('../util/sequential-promise-map'),
	validCredentials = require('../util/valid-credentials'),
	allowApiInvocation = require('./allow-api-invocation'),
	pathSplitter = require('../util/path-splitter'),
	loggingWrap = require('../util/logging-wrap'),
	retriableWrap = require('../util/retriable-wrap'),
	NullLogger = require('../util/null-logger'),
	safeHash = require('../util/safe-hash'),
	flattenRequestParameters = require('./flatten-request-parameters'),
	getOwnerId = require('./get-owner-account-id'),
	registerAuthorizers = require('./register-authorizers');
module.exports = function rebuildWebApi(functionName, functionVersion, restApiId, apiConfig, awsRegion, optionalLogger, configCacheStageVar) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		apiGateway = retriableWrap(
						loggingWrap(
							new aws.APIGateway({region: awsRegion}),
							{log: logger.logApiCall, logName: 'apigateway'}
						),
						function () {
							logger.logApiCall('rate-limited by AWS, waiting before retry');
						}),
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
			return apiGateway.getResourcesPromise({restApiId: restApiId, limit: 499});
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
			return apiGateway.putIntegrationPromise({
				restApiId: restApiId,
				resourceId: resourceId,
				httpMethod: httpMethod,
				type: 'MOCK',
				requestTemplates: {
					'application/json': '{\"statusCode\": 200}'
				}
			});
		},
		putLambdaIntegration = function (resourceId, methodName, credentials, cacheKeyParameters) {
			return apiGateway.putIntegrationPromise({
				restApiId: restApiId,
				resourceId: resourceId,
				httpMethod: methodName,
				credentials: credentials,
				type: 'AWS_PROXY',
				cacheKeyParameters: cacheKeyParameters,
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
		createMethod = function (methodName, resourceId, path) {
			var methodOptions = apiConfig.routes[path][methodName],
				apiKeyRequired = function () {
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
					return apiGateway.putMethodResponsePromise({
						restApiId: restApiId,
						resourceId: resourceId,
						httpMethod: methodName,
						statusCode: '200'
					}).then(function () {
						return apiGateway.putIntegrationResponsePromise({
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
				},
				parameters = flattenRequestParameters(methodOptions.requestParameters, path);
			return apiGateway.putMethodPromise({
				authorizationType: authorizationType(),
				authorizerId: authorizerId(),
				httpMethod: methodName,
				resourceId: resourceId,
				restApiId: restApiId,
				requestParameters: parameters,
				apiKeyRequired: apiKeyRequired()
			}).then(function () {
				return putLambdaIntegration(resourceId, methodName, credentials(), parameters && Object.keys(parameters));
			}).then(function () {
				return addMethodResponse();
			});
		},
		createCorsHandler = function (resourceId) {
			return apiGateway.putMethodPromise({
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
						'method.response.header.Access-Control-Allow-Origin': false,
						'method.response.header.Access-Control-Allow-Credentials': false,
						'method.response.header.Access-Control-Max-Age': false
					};
				}
				return apiGateway.putMethodResponsePromise({
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
						'method.response.header.Access-Control-Allow-Origin': '\'*\'',
						'method.response.header.Access-Control-Allow-Credentials': '\'true\''
					};
					if (apiConfig.corsMaxAge) {
						responseParams['method.response.header.Access-Control-Max-Age'] = '\'' + apiConfig.corsMaxAge + '\'';
					}
				}
				return apiGateway.putIntegrationResponsePromise({
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
					return apiGateway.createResourcePromise({
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
					return createMethod(methodName, resourceId, path);
				};
			return findResourceByPath(path).then(function (r) {
				resourceId = r;
			}).then(function () {
				return sequentialPromiseMap(supportedMethods, createMethodMapper);
			}).then(function () {
				if (supportsCors()) {
					return createCorsHandler(resourceId);
				}
			});
		},
		dropMethods = function (resource) {
			var dropMethodMapper = function (method) {
				return apiGateway.deleteMethodPromise({
					resourceId: resource.id,
					restApiId: restApiId,
					httpMethod: method
				});
			};
			if (resource.resourceMethods) {
				return sequentialPromiseMap(Object.keys(resource.resourceMethods), dropMethodMapper);
			} else {
				return Promise.resolve();
			}
		},
		removeResource = function (resource) {
			if (resource.path !== '/') {
				return apiGateway.deleteResourcePromise({
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
				return sequentialPromiseMap(Object.keys(apiConfig.routes), configurePath);
			});
		},
		deployApi = function () {
			var stageVars = {
				lambdaVersion: functionVersion
			};
			if (configCacheStageVar) {
				stageVars[configCacheStageVar] = configHash;
			}

			return apiGateway.createDeploymentPromise({
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
				.then(deployApi)
				.then(function () {
					return { cacheReused: false };
				});
		},
		getExistingConfigHash = function () {
			if (!configCacheStageVar) {
				return false;
			}
			return apiGateway.getStagePromise({
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
				return { cacheReused: true };
			} else {
				return uploadApiConfig();
			}
		});

};
