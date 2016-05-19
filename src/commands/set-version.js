/*global module, require*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	allowApiInvocation = require('../tasks/allow-api-invocation'),
	retriableWrap = require('../util/retriable-wrap'),
	promiseWrap = require('../util/promise-wrap'),
	apiGWUrl = require('../util/apigw-url'),
	NullLogger = require('../util/null-logger'),
	markAlias = require('../tasks/mark-alias');
module.exports = function setVersion(options, optionalLogger) {
	'use strict';
	var lambdaConfig, lambda, apiGateway, apiConfig,
		logger = optionalLogger || new NullLogger(),
		iam = promiseWrap(new aws.IAM(), {log: logger.logApiCall, logName: 'iam'}),
		updateApi = function () {
			return iam.getUserPromise().then(function (result) {
				return result.User.Arn.split(':')[4];
			}).then(function (ownerId) {
				return allowApiInvocation(lambdaConfig.name, options.version, apiConfig.id, ownerId, lambdaConfig.region);
			}).then(function () {
				return apiGateway.createDeploymentPromise({
					restApiId: apiConfig.id,
					stageName: options.version,
					variables: {
						lambdaVersion: options.version
					}
				});
			}).then(function () {
				return {url: apiGWUrl(apiConfig.id, lambdaConfig.region, options.version) };
			});
		};
	if (!options.version) {
		return Promise.reject('version misssing. please provide using --version');
	}
	logger.logStage('loading config');
	return loadConfig(options, {lambda: {name: true, region: true}}).then(function (config) {
		lambdaConfig = config.lambda;
		apiConfig = config.api;
		lambda = promiseWrap(new aws.Lambda({region: lambdaConfig.region}), {log: logger.logApiCall, logName: 'lambda'});
		apiGateway = retriableWrap(
			promiseWrap(
				new aws.APIGateway({region:  lambdaConfig.region}),
				{log: logger.logApiCall, logName: 'apigateway'}
			),
			function () {
				logger.logStage('rate-limited by AWS, waiting before retry');
			});
	}).then(function () {
		logger.logStage('updating versions');
		return lambda.publishVersionPromise({FunctionName: lambdaConfig.name});
	}).then(function (versionResult) {
		return markAlias(lambdaConfig.name, lambda, versionResult.Version, options.version);
	}).then(function () {
		if (apiConfig && apiConfig.id) {
			return updateApi();
		}
	});
};
module.exports.doc = {
	description: 'Create or update a lambda alias/api stage to point to the latest deployed version',
	priority: 3,
	args: [
		{
			argument: 'version',
			description: 'the alias to update or create',
			example: 'production'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			default: 'current directory'
		},
		{
			argument: 'config',
			optional: true,
			description: 'Config file containing the resource names',
			default: 'claudia.json'
		}
	]
};
