/*global module, require */
var aws = require('aws-sdk'),
	Promise = require('bluebird'),
	promiseWrap = require('../util/promise-wrap'),
	retriableWrap = require('../util/retriable-wrap'),
	NullLogger = require('../util/null-logger');
module.exports = function registerAuthorizers(authorizerMap, apiId, awsRegion, optionalLogger) {
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
		lambda = promiseWrap(new aws.Lambda({region: awsRegion}), {log: logger.logApiCall, logName: 'lambda'}),
		removeAuthorizer = function (authConfig) {
			return apiGateway.deleteAuthorizerAsync({
				authorizerId: authConfig.id,
				restApiId: apiId
			});
		},
		getAuthorizerArn = function (authConfig) {
			if (authConfig.lambdaArn) {
				return Promise.resolve(authConfig.lambdaArn);
			} else {
				return lambda.getFunctionConfigurationPromise({FunctionName: authConfig.lambdaName}).then(function (lambdaConfig) {
					return lambdaConfig.FunctionArn;
				});
			}

		},
		addAuthorizer = function (authName) {
			var authConfig = authorizerMap[authName];
			return getAuthorizerArn(authConfig).then(function (lambdaArn) {
				return apiGateway.createAuthorizerAsync({
					identitySource: 'method.request.header.' + (authConfig.headerName || 'Authorization'),
					name: authName,
					restApiId: apiId,
					type: 'TOKEN',
					authorizerUri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + lambdaArn + '/invocations'
				});
			});
		},
		authorizerNames = Object.keys(authorizerMap);

	return apiGateway.getAuthorizersAsync({
		restApiId: apiId
	}).then(function (existingAuthorizers) {
		return Promise.map(existingAuthorizers.items, removeAuthorizer, {concurrency: 1});
	}).then(function () {
		return Promise.map(authorizerNames, addAuthorizer, {concurrency: 1});
	}).then(function (creationResults) {
		var index,
			result = {};
		for (index = 0; index < authorizerNames.length; index++) {
			result[authorizerNames[index]] = creationResults[index].id;
		}
		return result;
	});
};
