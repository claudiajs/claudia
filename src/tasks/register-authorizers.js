const loggingWrap = require('../util/logging-wrap'),
	retriableWrap = require('../util/retriable-wrap'),
	allowApiInvocation = require('./allow-api-invocation'),
	NullLogger = require('../util/null-logger'),
	sequentialPromiseMap = require('sequential-promise-map');

const {
    APIGateway
} = require("@aws-sdk/client-api-gateway");

const {
    Lambda
} = require("@aws-sdk/client-lambda");

module.exports = function registerAuthorizers(authorizerMap, apiId, ownerAccount, awsPartition, awsRegion, functionVersion, optionalLogger) {
	'use strict';
	const logger = optionalLogger || new NullLogger(),
		apiGateway = retriableWrap(
			loggingWrap(
				new APIGateway({
                    region: awsRegion
                }),
				{log: logger.logApiCall, logName: 'apigateway'}
			),
			() => logger.logApiCall('rate-limited by AWS, waiting before retry')
		),
		lambda = loggingWrap(new Lambda({region: awsRegion}), {log: logger.logApiCall, logName: 'lambda'}),
		removeAuthorizer = function (authConfig) {
			return apiGateway.deleteAuthorizerPromise({
				authorizerId: authConfig.id,
				restApiId: apiId
			});
		},
		getAuthorizerType = function (authConfig) {
			return authConfig.type || (authConfig.providerARNs ? 'COGNITO_USER_POOLS' : 'TOKEN');
		},
		getAuthorizerArn = function (authConfig) {
			if (authConfig.lambdaArn) {
				return Promise.resolve(authConfig.lambdaArn);
			} else if (authConfig.lambdaName) {
				return lambda.getFunctionConfiguration({FunctionName: authConfig.lambdaName}).promise()
				.then(lambdaConfig => {
					let suffix = '';
					if (authConfig.lambdaVersion === true) {
						suffix = ':${stageVariables.lambdaVersion}';
					} else if (authConfig.lambdaVersion) {
						suffix = ':' + authConfig.lambdaVersion;
					}
					return lambdaConfig.FunctionArn + suffix;
				});
			} else {
				return Promise.reject('Cannot retrieve lambda arn for authorizer ' + JSON.stringify(authConfig));
			}
		},
		allowInvocation = function (authConfig/*, authorizerId */) {
			let authLambdaQualifier;
			if (authConfig.lambdaVersion && (typeof authConfig.lambdaVersion === 'string')) {
				authLambdaQualifier = authConfig.lambdaVersion;
			} else if (authConfig.lambdaVersion === true) {
				authLambdaQualifier = functionVersion;
			}
			if (authConfig.lambdaName) {
				return allowApiInvocation(authConfig.lambdaName, authLambdaQualifier, apiId, ownerAccount, awsPartition, awsRegion, 'authorizers/*');
			} else {
				return Promise.resolve();
			}
		},
		configureAuthorizer = function (authConfig, lambdaArn, authName) {
			const type = getAuthorizerType(authConfig),
				identityHeader = 'method.request.header.' + (authConfig.headerName || 'Authorization'),
				identitySource = authConfig.identitySource || identityHeader,
				params = {
					identitySource: identitySource,
					name: authName,
					restApiId: apiId,
					type: type
				};
			if (type === 'COGNITO_USER_POOLS') {
				params.providerARNs = authConfig.providerARNs;
			} else {
				params.authorizerUri = 'arn:' + awsPartition + ':apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + lambdaArn + '/invocations';
			}
			if (authConfig.validationExpression) {
				params.identityValidationExpression = authConfig.validationExpression;
			}
			if (authConfig.credentials) {
				params.authorizerCredentials = authConfig.credentials;
			}
			if (Number.isInteger(authConfig.resultTtl)) {
				params.authorizerResultTtlInSeconds = authConfig.resultTtl;
			}
			return params;
		},
		initializeAuthorizerConfiguration = function (authName) {
			const authConfig = authorizerMap[authName];
			if (getAuthorizerType(authConfig) === 'COGNITO_USER_POOLS') {
				return Promise.resolve(configureAuthorizer(authConfig, null, authName));
			} else {
				return allowInvocation(authConfig)
					.then(() => getAuthorizerArn(authConfig))
					.then(lambdaArn => configureAuthorizer(authConfig, lambdaArn, authName));
			}
		},
		addAuthorizer = function (authName) {
			return initializeAuthorizerConfiguration(authName)
				.then(configuration => apiGateway.createAuthorizerPromise(configuration))
				.then(result => result.id);
		},
		authorizerNames = Object.keys(authorizerMap);

	return apiGateway.getAuthorizersPromise({restApiId: apiId})
	.then(existingAuthorizers => sequentialPromiseMap(existingAuthorizers.items, removeAuthorizer))
	.then(() => sequentialPromiseMap(authorizerNames, addAuthorizer))
	.then(creationResults => {
		let index;
		const result = {};
		for (index = 0; index < authorizerNames.length; index++) {
			result[authorizerNames[index]] = creationResults[index];
		}
		return result;
	});
};
