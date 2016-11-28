/*global module, require, Promise */
var aws = require('aws-sdk'),
	loggingWrap = require('../util/logging-wrap'),
	retriableWrap = require('../util/retriable-wrap'),
	allowApiInvocation = require('./allow-api-invocation'),
	NullLogger = require('../util/null-logger'),
	sequentialPromiseMap = require('../util/sequential-promise-map'),
	getOwnerId = require('./get-owner-account-id');
module.exports = function registerAuthorizers(authorizerMap, apiId, awsRegion, functionVersion, optionalLogger) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		ownerId,
		apiGateway = retriableWrap(
			loggingWrap(
				new aws.APIGateway({region: awsRegion}),
				{log: logger.logApiCall, logName: 'apigateway'}
			),
			function () {
				logger.logApiCall('rate-limited by AWS, waiting before retry');
			}
		),
		lambda = loggingWrap(new aws.Lambda({region: awsRegion}), {log: logger.logApiCall, logName: 'lambda'}),
		removeAuthorizer = function (authConfig) {
			return apiGateway.deleteAuthorizerPromise({
				authorizerId: authConfig.id,
				restApiId: apiId
			});
		},
		getAuthorizerArn = function (authConfig) {
			if (authConfig.lambdaArn) {
				return Promise.resolve(authConfig.lambdaArn);
			} else {
				return lambda.getFunctionConfiguration({FunctionName: authConfig.lambdaName}).promise().then(function (lambdaConfig) {
					var suffix = '';
					if (authConfig.lambdaVersion === true) {
						suffix = ':${stageVariables.lambdaVersion}';
					} else if (authConfig.lambdaVersion) {
						suffix = ':' + authConfig.lambdaVersion;
					}
					return lambdaConfig.FunctionArn + suffix;
				});
			}

		},
		allowInvocation = function (authConfig/*, authorizerId */) {
			var authLambdaQualifier;
			if (authConfig.lambdaVersion && typeof authConfig.lambdaVersion === 'string') {
				authLambdaQualifier = authConfig.lambdaVersion;
			} else if (authConfig.lambdaVersion === true) {
				authLambdaQualifier = functionVersion;
			}
			if (authConfig.lambdaName) {
				return allowApiInvocation(authConfig.lambdaName, authLambdaQualifier, apiId, ownerId, awsRegion, 'authorizers/*');
			}
		},
		configureAuthorizer = function (authConfig, lambdaArn, authName) {
			var params = {
				identitySource: 'method.request.header.' + (authConfig.headerName || 'Authorization'),
				name: authName,
				restApiId: apiId,
				type: 'TOKEN',
				authorizerUri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + lambdaArn + '/invocations'
			};
			if (authConfig.validationExpression) {
				params.identityValidationExpression = authConfig.validationExpression;
			}
			if (authConfig.credentials) {
				params.authorizerCredentials = authConfig.credentials;
			}
			if (authConfig.resultTtl) {
				params.authorizerResultTtlInSeconds = authConfig.resultTtl;
			}
			return params;
		},
		addAuthorizer = function (authName) {
			var authConfig = authorizerMap[authName],
				lambdaArn;
			return getAuthorizerArn(authConfig).then(function (functionArn) {
				lambdaArn = functionArn;
			}).then(function () {
				return allowInvocation(authConfig);
			}).then(function () {
				return apiGateway.createAuthorizerPromise(configureAuthorizer(authConfig, lambdaArn, authName));
			}).then(function (result) {
				return result.id;
			});
		},
		authorizerNames = Object.keys(authorizerMap);


	return apiGateway.getAuthorizersPromise({
		restApiId: apiId
	}).then(function (existingAuthorizers) {
		return sequentialPromiseMap(existingAuthorizers.items, removeAuthorizer);
	}).then(function () {
		return getOwnerId();
	}).then(function (accountId) {
		ownerId = accountId;
	}).then(function () {
		return sequentialPromiseMap(authorizerNames, addAuthorizer);
	}).then(function (creationResults) {
		var index,
			result = {};
		for (index = 0; index < authorizerNames.length; index++) {
			result[authorizerNames[index]] = creationResults[index];
		}
		return result;
	});
};
