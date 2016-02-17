/*global module, require*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	allowApiInvocation = require('../tasks/allow-api-invocation'),
	markAlias = require('../tasks/mark-alias');
module.exports = function setVersion(options) {
	'use strict';
	var lambdaConfig, lambda, apiGateway, apiConfig,
		iam = Promise.promisifyAll(new aws.IAM()),
		updateApi = function () {
			return iam.getUserAsync().then(function (result) {
				return result.User.UserId;
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

	return loadConfig(options.source, {lambda: {name: true, region: true}}).then(function (config) {
		lambdaConfig = config.lambda;
		apiConfig = config.api;
		lambda = Promise.promisifyAll(new aws.Lambda({region: lambdaConfig.region}), {suffix: 'Promise'});
		apiGateway = Promise.promisifyAll(new aws.APIGateway({region: lambdaConfig.region}));
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
