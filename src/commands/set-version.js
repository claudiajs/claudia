/*global module, require*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	allowApiInvocation = require('../tasks/allow-api-invocation'),
	retriableWrap = require('../util/wrap'),
	markAlias = require('../tasks/mark-alias');
module.exports = function setVersion(options) {
	'use strict';
	var lambdaConfig, lambda, apiGateway, apiConfig,
		iam = Promise.promisifyAll(new aws.IAM()),
		updateApi = function () {
			return iam.getUserAsync().then(function (result) {
				return result.User.Arn.split(':')[4];
			}).then(function (ownerId) {
				return allowApiInvocation(lambdaConfig.name, options.version, apiConfig.id, ownerId, lambdaConfig.region);
			}).then(function () {
				return apiGateway.createDeploymentAsync({
					restApiId: apiConfig.id,
					stageName: options.version,
					variables: {
						lambdaVersion: options.version
					}
				});
			});
		};
	if (!options.version) {
		return Promise.reject('version misssing. please provide using --version');
	}

	return loadConfig(options, {lambda: {name: true, region: true}}).then(function (config) {
		lambdaConfig = config.lambda;
		apiConfig = config.api;
		lambda = Promise.promisifyAll(new aws.Lambda({region: lambdaConfig.region}), {suffix: 'Promise'});
		apiGateway = retriableWrap('apiGateway', Promise.promisifyAll(new aws.APIGateway({region: lambdaConfig.region})));
	}).then(function () {
		return lambda.publishVersionPromise({FunctionName: lambdaConfig.name});
	}).then(function (versionResult) {
		return markAlias(lambdaConfig.name, lambdaConfig.region, versionResult.Version, options.version);
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
