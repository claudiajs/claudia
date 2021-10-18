const aws = require('aws-sdk'),
	validAuthType = require('../util/valid-auth-type'),
	sequentialPromiseMap = require('sequential-promise-map'),
	validCredentials = require('../util/valid-credentials'),
	allowApiInvocation = require('./allow-api-invocation'),
	pathSplitter = require('../util/path-splitter'),
	loggingWrap = require('../util/logging-wrap'),
	retriableWrap = require('../util/retriable-wrap'),
	NullLogger = require('../util/null-logger'),
	safeHash = require('../util/safe-hash'),
	flattenRequestParameters = require('./flatten-request-parameters'),
	patchBinaryTypes = require('./patch-binary-types'),
	clearApi = require('./clear-api'),
	registerAuthorizers = require('./register-authorizers');
module.exports = function rebuildWebApi(functionName, functionVersion, restApiId, apiConfig, ownerAccount, awsPartition, awsRegion, optionalLogger, configCacheStageVar) {
	'use strict';
	let authorizerIds;
	const logger = optionalLogger || new NullLogger(),
		apiGateway = retriableWrap(
			loggingWrap(
				new aws.APIGateway({region: awsRegion}),
				{log: logger.logApiCall, logName: 'apigateway'}
			),
			() => logger.logApiCall('rate-limited by AWS, waiting before retry')
		),
		configHash = safeHash(apiConfig),
		knownIds = {},
		supportsCors = function () {
			return (apiConfig.corsHandlers !== false);
		},
		supportsMockCorsIntegration = function () {
			return supportsCors && apiConfig.corsHandlers !== true;
		},
		putMockIntegration = function (resourceId, httpMethod) {
			return apiGateway.putIntegrationPromise({
				restApiId: restApiId,
				resourceId: resourceId,
				httpMethod: httpMethod,
				type: 'MOCK',
				requestTemplates: {
					'application/json': '{"statusCode": 200}'
				}
			});
		},
		putLambdaIntegration = function (resourceId, methodName, credentials, cacheKeyParameters, integrationContentHandling) {
			return apiGateway.putIntegrationPromise({
				restApiId: restApiId,
				resourceId: resourceId,
				httpMethod: methodName,
				credentials: credentials,
				type: 'AWS_PROXY',
				cacheKeyParameters: cacheKeyParameters,
				integrationHttpMethod: 'POST',
				passthroughBehavior: 'WHEN_NO_MATCH',
				contentHandling: integrationContentHandling,
				uri: 'arn:' + awsPartition + ':apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/arn:' + awsPartition + ':lambda:' + awsRegion + ':' + ownerAccount + ':function:' + functionName + ':${stageVariables.lambdaVersion}/invocations'
			});
		},
		corsHeaderValue = function () {
			if (apiConfig.corsHeaders === '') {
				return '';
			}
			if (!supportsCors()) {
				return '';
			}
			const val = apiConfig.corsHeaders || 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token';
			return '\'' + val + '\'';
		},
		createMethod = function (methodName, resourceId, path) {
			const methodOptions = apiConfig.routes[path][methodName],
				apiKeyRequired = function () {
					return methodOptions && methodOptions.apiKeyRequired;
				},
				authorizationScopes = function () {
					return methodOptions && methodOptions.authorizationScopes;
				},
				authorizationType = function () {
					if (methodOptions && methodOptions.authorizationType && validAuthType(methodOptions.authorizationType.toUpperCase())) {
						return methodOptions.authorizationType.toUpperCase();
					} else if (methodOptions.customAuthorizer) {
						return 'CUSTOM';
					} else if (methodOptions.cognitoAuthorizer) {
						return 'COGNITO_USER_POOLS';
					} else if (methodOptions && validCredentials(methodOptions.invokeWithCredentials)) {
						return 'AWS_IAM';
					} else {
						return 'NONE';
					}
				},
				credentials = function () {
					if (methodOptions && methodOptions.invokeWithCredentials) {
						if (methodOptions.invokeWithCredentials === true) {
							return 'arn:' + awsPartition + ':iam::*:user/*';
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
					})
					.then(() => apiGateway.putIntegrationResponsePromise({
						restApiId: restApiId,
						resourceId: resourceId,
						httpMethod: methodName,
						contentHandling: methodOptions && methodOptions.success && methodOptions.success.contentHandling,
						statusCode: '200'
					}));
				},
				authorizerId = function () {
					const authorizerName = methodOptions.customAuthorizer || methodOptions.cognitoAuthorizer;
					return methodOptions && authorizerName && authorizerIds[authorizerName];
				},
				parameters = flattenRequestParameters(methodOptions.requestParameters, path);
			return apiGateway.putMethodPromise({
				authorizationType: authorizationType(),
				authorizerId: authorizerId(),
				httpMethod: methodName,
				resourceId: resourceId,
				restApiId: restApiId,
				requestParameters: parameters,
				apiKeyRequired: apiKeyRequired(),
				authorizationScopes: authorizationScopes()
			})
			.then(() => putLambdaIntegration(resourceId, methodName, credentials(), parameters && Object.keys(parameters), methodOptions.requestContentHandling))
			.then(addMethodResponse);
		},
		createCorsHandler = function (resourceId, supportedMethods) {
			return apiGateway.putMethodPromise({
				authorizationType: 'NONE',
				httpMethod: 'OPTIONS',
				resourceId: resourceId,
				restApiId: restApiId
			})
			.then(() => {
				if (supportsMockCorsIntegration()) {
					return putMockIntegration(resourceId, 'OPTIONS');
				} else {
					return putLambdaIntegration(resourceId, 'OPTIONS');
				}
			})
			.then(() => {
				let responseParams = null;
				if (supportsMockCorsIntegration()) {
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
					responseParameters: responseParams
				});
			})
			.then(() => {
				let responseParams = null;
				if (supportsMockCorsIntegration()) {
					const corsDomain = (supportsMockCorsIntegration() && apiConfig.corsHandlers) || '*',
						corsHeaders = corsHeaderValue();

					responseParams = {
						'method.response.header.Access-Control-Allow-Methods': `'OPTIONS,${supportedMethods.sort().join(',')}'`,
						'method.response.header.Access-Control-Allow-Origin': `'${corsDomain}'`,
						'method.response.header.Access-Control-Allow-Credentials': '\'true\''
					};
					if (corsHeaders) {
						responseParams['method.response.header.Access-Control-Allow-Headers'] = corsHeaders;
					}
					if (apiConfig.corsMaxAge) {
						responseParams['method.response.header.Access-Control-Max-Age'] = '\'' + apiConfig.corsMaxAge + '\'';
					}
				}
				return apiGateway.putIntegrationResponsePromise({
					restApiId: restApiId,
					resourceId: resourceId,
					httpMethod: 'OPTIONS',
					statusCode: '200',
					responseParameters: responseParams
				});
			});
		},
		findResourceByPath = function (path) {
			const pathComponents = pathSplitter(path);
			if (knownIds[path]) {
				return Promise.resolve(knownIds[path]);
			} else {
				return findResourceByPath(pathComponents.parentPath)
				.then(parentId => apiGateway.createResourcePromise({
					restApiId: restApiId,
					parentId: parentId,
					pathPart: pathComponents.pathPart
				}))
				.then(resource => {
					knownIds[path] = resource.id;
					return resource.id;
				});
			}
		},
		configurePath = function (path) {
			let resourceId;
			const supportedMethods = Object.keys(apiConfig.routes[path]),
				hasCustomCorsHandler = apiConfig.routes[path].OPTIONS,
				createMethodMapper = function (methodName) {
					return createMethod(methodName, resourceId, path);
				};
			return findResourceByPath(path)
			.then(r => {
				resourceId = r;
			})
			.then(() => sequentialPromiseMap(supportedMethods, createMethodMapper))
			.then(() => {
				if (!supportsCors() || hasCustomCorsHandler) {
					return;
				}
				return createCorsHandler(resourceId, supportedMethods);
			});
		},
		configureGatewayResponse = function (responseType, responseConfig) {
			const params = {
				restApiId: restApiId,
				responseType: responseType
			};
			if (responseConfig.statusCode) {
				params.statusCode = String(responseConfig.statusCode);
			}
			if (responseConfig.responseParameters) {
				params.responseParameters = responseConfig.responseParameters;
			}
			if (responseConfig.responseTemplates) {
				params.responseTemplates = responseConfig.responseTemplates;
			}
			if (responseConfig.headers) {
				params.responseParameters = params.responseParameters || {};
				Object.keys(responseConfig.headers).forEach(header => {
					params.responseParameters[`gatewayresponse.header.${header}`] = `'${responseConfig.headers[header]}'`;
				});
			}
			return apiGateway.putGatewayResponsePromise(params);

		},
		removeExistingResources = function () {
			return clearApi(apiGateway, restApiId, functionName);
		},
		cacheRootId = function () {
			return apiGateway.getResourcesPromise({restApiId: restApiId, limit: 499})
			.then(resources => {
				resources.items.forEach(resource => {
					const pathWithoutStartingSlash = resource.path.replace(/^\//, '');
					knownIds[pathWithoutStartingSlash] = resource.id;
				});
			});
		},
		rebuildApi = function () {
			return allowApiInvocation(functionName, functionVersion, restApiId, ownerAccount, awsPartition, awsRegion)
			.then(() => cacheRootId())
			.then(() => sequentialPromiseMap(Object.keys(apiConfig.routes), configurePath))
			.then(() => {
				if (apiConfig.customResponses) {
					return sequentialPromiseMap(Object.keys(apiConfig.customResponses), responseType => configureGatewayResponse(responseType, apiConfig.customResponses[responseType]));
				}
			})
			.then(() => {
				if (apiConfig.binaryMediaTypes) {
					return patchBinaryTypes(restApiId, apiGateway, apiConfig.binaryMediaTypes);
				}
			});
		},
		deployApi = function () {
			const stageVars = {
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
				return registerAuthorizers(apiConfig.authorizers, restApiId, ownerAccount, awsPartition, awsRegion, functionVersion, logger)
				.then(result => {
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
				.then(() => ({ cacheReused: false }));
		},
		getExistingConfigHash = function () {
			if (!configCacheStageVar) {
				return Promise.resolve(false);
			}
			return apiGateway.getStagePromise({ restApiId: restApiId, stageName: functionVersion })
				.then(stage => stage.variables && stage.variables[configCacheStageVar])
				.catch(() => false);
		};
	return getExistingConfigHash()
		.then(existingHash => {
			if (existingHash && existingHash === configHash) {
				logger.logStage('Reusing cached API configuration');
				return { cacheReused: true };
			} else {
				return uploadApiConfig();
			}
		});
};
