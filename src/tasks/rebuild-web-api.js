/*global module, require */
var aws = require('aws-sdk'),
	Promise = require('bluebird'),
	templateFile = require('../util/template-file'),
	validHttpCode = require('../util/valid-http-code'),
	validAuthType = require('../util/valid-auth-type'),
	validCredentials = require('../util/valid-credentials'),
	allowApiInvocation = require('./allow-api-invocation'),
	pathSplitter = require('../util/path-splitter'),
	promiseWrap = require('../util/promise-wrap'),
	retriableWrap = require('../util/retriable-wrap'),
	NullLogger = require('../util/null-logger'),
	fs = Promise.promisifyAll(require('fs'));
module.exports = function rebuildWebApi(functionName, functionVersion, restApiId, requestedConfig, awsRegion, optionalLogger) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		iam = promiseWrap(new aws.IAM(), {log: logger.logApiCall, logName: 'iam'}),
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
		apiConfig,
		existingResources,
		ownerId,
		knownIds = {},
		inputTemplate,
		getOwnerId = function () {
			return iam.getUserPromise().then(function (result) {
				ownerId = result.User.Arn.split(':')[4];
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
				type: 'AWS',
				integrationHttpMethod: 'POST',
				requestTemplates: {
					'application/json': inputTemplate,
					'application/x-www-form-urlencoded': inputTemplate,
					'text/xml': inputTemplate,
					'application/xml': inputTemplate,
					'text/plain': inputTemplate
				},
				uri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/arn:aws:lambda:' + awsRegion + ':' + ownerId + ':function:' + functionName + ':${stageVariables.lambdaVersion}/invocations'
			});
		},
		corsHeaderValue = function () {
			var val = apiConfig.corsHeaders || 'Content-Type,X-Amz-Date,Authorization,X-Api-Key';
			if (!supportsCors()) {
				return '';
			}
			return '\'' + val + '\'';
		},
		createMethod = function (methodName, resourceId, methodOptions) {
			var errorCode = function () {
					if (!methodOptions.error) {
						return '500';
					}
					if (validHttpCode(methodOptions.error)) {
						return String(methodOptions.error);
					}
					if (methodOptions.error && methodOptions.error.code && validHttpCode(methodOptions.error.code)) {
						return String(methodOptions.error.code);
					}
					return '500';
				},
				successCode = function () {
					if (!methodOptions.success) {
						return '200';
					}
					if (validHttpCode(methodOptions.success)) {
						return String(methodOptions.success);
					}
					if (methodOptions.success && methodOptions.success.code && validHttpCode(methodOptions.success.code)) {
						return String(methodOptions.success.code);
					}
					return '200';
				},
				apiKeyRequired = function () {
					return methodOptions && methodOptions.apiKeyRequired;
				},
				authorizationType = function () {
					if (methodOptions && methodOptions.authorizationType && validAuthType(methodOptions.authorizationType.toUpperCase())) {
						return methodOptions.authorizationType.toUpperCase();
					} else if (methodOptions && (methodOptions.invokeWithCredentials === true || validCredentials(methodOptions.invokeWithCredentials))) {
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
				isRedirect = function (code) {
					return /3[0-9][0-9]/.test(code);
				},
				errorContentType = function () {
					return methodOptions && methodOptions.error && methodOptions.error.contentType;
				},
				headers = function (responseType) {
					return methodOptions && methodOptions[responseType] && methodOptions[responseType].headers;
				},
				successContentType = function () {
					return methodOptions && methodOptions.success && methodOptions.success.contentType;
				},
				successTemplate = function (headers) {
					// success codes can also be used as error codes, so this has to work for both
					var contentType = successContentType(), extractor = 'path';
					if (contentType && contentType.indexOf(';') >= 0) {
						contentType = contentType.split(';')[0];
					}
					if (!contentType || contentType === 'application/json') {
						extractor = 'json';
					}
					if (headers && Array.isArray(headers)) {
						return '#if($input.path(\'$.errorMessage\')!="")' +
							'$input.' + extractor + '(\'$\')' +
							'#{else}' +
							'$input.' + extractor + '(\'$.response\')' +
							'#{end}';
					} else {
						return '$input.' + extractor + '(\'$\')';
					}
				},
				errorTemplate = function () {
					var contentType = errorContentType();
					if (!contentType || contentType === 'application/json') {
						return '';
					}
					return '$input.path(\'$.errorMessage\')';
				},
				addCodeMapper = function (response) {
					var methodResponseParams = { },
						integrationResponseParams = { },
						responseTemplates = {},
						responseModels = {},
						contentType = response.contentType || 'application/json',
						headersInBody = function () {
							return response.headers && Array.isArray(response.headers);
						},
						headerNames = response.headers && (Array.isArray(response.headers) ? response.headers : Object.keys(response.headers));
					if (supportsCors()) {
						methodResponseParams = {
							'method.response.header.Access-Control-Allow-Origin': false,
							'method.response.header.Access-Control-Allow-Headers': false
						};
						integrationResponseParams = {
							'method.response.header.Access-Control-Allow-Origin': '\'*\'',
							'method.response.header.Access-Control-Allow-Headers': corsHeaderValue()
						};
					}
					if (isRedirect(response.code)) {
						methodResponseParams['method.response.header.Location'] = false;
						if (!headersInBody()) {
							integrationResponseParams['method.response.header.Location'] = 'integration.response.body';
						} else {
							integrationResponseParams['method.response.header.Location'] = 'integration.response.body.response';
						}
						responseTemplates[contentType] = '##';
					} else {
						if (response.contentType) {
							methodResponseParams['method.response.header.Content-Type'] = false;
							integrationResponseParams['method.response.header.Content-Type'] = '\'' + response.contentType + '\'';
						}
						responseTemplates[contentType] = response.template || '';
					}
					if (response.headers) {
						headerNames.forEach(function (headerName) {
							methodResponseParams['method.response.header.' + headerName] = false;
							if (headersInBody()) {
								integrationResponseParams['method.response.header.' + headerName] = 'integration.response.body.headers.' + headerName;
							} else {
								integrationResponseParams['method.response.header.' + headerName] = '\'' + response.headers[headerName] + '\'';
							}
						});
					}
					responseModels[contentType] = 'Empty';
					return apiGateway.putMethodResponseAsync({
						restApiId: restApiId,
						resourceId: resourceId,
						httpMethod: methodName,
						statusCode: response.code,
						responseParameters: methodResponseParams,
						responseModels: responseModels
					}).then(function () {
						return apiGateway.putIntegrationResponseAsync({
							restApiId: restApiId,
							resourceId: resourceId,
							httpMethod: methodName,
							statusCode: response.code,
							selectionPattern: response.pattern,
							responseParameters: integrationResponseParams,
							responseTemplates: responseTemplates
						});
					});
				};
			return apiGateway.putMethodAsync({
				authorizationType: authorizationType(),
				httpMethod: methodName,
				resourceId: resourceId,
				restApiId: restApiId,
				apiKeyRequired: apiKeyRequired()
			}).then(function () {
				return putLambdaIntegration(resourceId, methodName, credentials());
			}).then(function () {
				var results = [{code: successCode(), pattern: '', contentType: successContentType(), template: successTemplate(headers('success')), headers: headers('success')}];
				if (errorCode() !== successCode()) {
					results[0].pattern = '^$';
					results.push({code: errorCode(), pattern: '', contentType: errorContentType(), template: errorTemplate(), headers: headers('error')});
				}
				return Promise.map(results, addCodeMapper, {concurrency: 1});
			});
		},
		createCorsHandler = function (resourceId, allowedMethods) {
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
				return apiGateway.putMethodResponseAsync({
					restApiId: restApiId,
					resourceId: resourceId,
					httpMethod: 'OPTIONS',
					statusCode: '200',
					responseModels: {
						'application/json': 'Empty'
					},
					responseParameters: {
						'method.response.header.Access-Control-Allow-Headers': false,
						'method.response.header.Access-Control-Allow-Methods': false,
						'method.response.header.Access-Control-Allow-Origin': false
					}
				});
			}).then(function () {
				var responseParams = {
						'method.response.header.Access-Control-Allow-Headers': corsHeaderValue(),
						'method.response.header.Access-Control-Allow-Methods': '\'' + allowedMethods.join(',') + ',OPTIONS\'',
						'method.response.header.Access-Control-Allow-Origin': '\'*\''
					};
				if (apiConfig.corsHandlers) {
					responseParams['method.response.header.Access-Control-Allow-Origin'] = 'integration.response.body';
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
					return createCorsHandler(resourceId, supportedMethods);
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
		readTemplates = function () {
			return fs.readFileAsync(templateFile('apigw-params.txt'), 'utf8')
			.then(function (fileContents) {
				inputTemplate = fileContents;
			});
		},
		pathSort = function (resA, resB) {
			if (resA.path > resB.path) {
				return 1;
			} else if (resA.path === resB.path) {
				return 0;
			}
			return -1;
		},
		rebuildApi = function () {
			return allowApiInvocation(functionName, functionVersion, restApiId, ownerId, awsRegion)
			.then(getExistingResources)
			.then(function (resources) {
				existingResources = resources.items;
				existingResources.sort(pathSort);
				return existingResources;
			}).then(findRoot)
			.then(dropSubresources)
			.then(function () {
				return Promise.map(Object.keys(apiConfig.routes), configurePath, {concurrency: 1});
			});
		},
		deployApi = function () {
			return apiGateway.createDeploymentAsync({
				restApiId: restApiId,
				stageName: functionVersion,
				variables: {
					lambdaVersion: functionVersion
				}
			});
		},
		upgradeConfig = function (config) {
			var result;
			if (config.version >= 2) {
				return config;
			}
			result = { version: 3, routes: {} };
			Object.keys(config).forEach(function (route) {
				result.routes[route] = {};
				config[route].methods.forEach(function (methodName) {
					result.routes[route][methodName] = {};
				});
			});
			return result;
		};
	apiConfig = upgradeConfig(requestedConfig);
	return getOwnerId()
		.then(readTemplates)
		.then(rebuildApi)
		.then(deployApi);
};
