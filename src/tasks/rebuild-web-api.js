/*global module, require */
var aws = require('aws-sdk'),
	Promise = require('bluebird'),
	templateFile = require('../util/template-file'),
	fs = Promise.promisifyAll(require('fs'));
module.exports = function rebuildWebApi(functionName, functionVersion, functionArn, restApiId, apiConfig, awsRegion) {
	'use strict';
	var iam = Promise.promisifyAll(new aws.IAM()),
		lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'}),
		apiGateway = Promise.promisifyAll(new aws.APIGateway({region: awsRegion})),
		existingResources,
		rootResourceId,
		paramsInputTemplate,
		allowApiInvocation = function () {
			return iam.getUserAsync().then(function (result) {
				return lambda.addPermissionPromise({
					Action: 'lambda:InvokeFunction',
					FunctionName: functionName,
					Principal: 'apigateway.amazonaws.com',
					SourceArn: 'arn:aws:execute-api:' + awsRegion + ':' + result.User.UserId + ':' + restApiId + '/*/*/*',
					Qualifier: functionVersion,
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
		createMethod = function (methodName, resourceId) {
			return apiGateway.putMethodAsync({
				authorizationType: 'NONE', /*todo support config */
				httpMethod: methodName,
				resourceId: resourceId,
				restApiId: restApiId
			}).then(function () {
				return apiGateway.putIntegrationAsync({
					restApiId: restApiId,
					resourceId: resourceId,
					httpMethod: methodName,
					type: 'AWS',
					integrationHttpMethod: 'POST',
					requestTemplates: {
						'application/json': paramsInputTemplate
					},
					uri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + functionArn + '/invocations'
				});
			}).then(function () {
				return apiGateway.putMethodResponseAsync({
					restApiId: restApiId,
					resourceId: resourceId,
					httpMethod: methodName,
					statusCode: '200',
					responseModels: {
						'application/json': 'Empty'
					}
				});
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
		createPath = function (path) {
			return apiGateway.createResourceAsync({
				restApiId: restApiId,
				parentId: rootResourceId,
				pathPart: path
			}).then(function (resource) {
				var createMethodMapper = function (methodName) {
					return createMethod(methodName, resource.id);
				};
				return Promise.map(apiConfig[path].methods, createMethodMapper, {concurrency: 1});
			});
		},
		rebuildApi = function (inputTemplate) {
			paramsInputTemplate = inputTemplate;
			return allowApiInvocation()
			.then(getExistingResources)
			.then(function (resources) {
				existingResources = resources.items;
				return existingResources;
			})
			.then(findRoot)
			.then(function () {
				return Promise.map(Object.keys(apiConfig), createPath, {concurrency: 1});
			});
		};
	return fs.readFileAsync(templateFile('apigw-params-input.txt'), 'utf8').then(rebuildApi);
};


