/*global module, require */
var aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	shell = require('shelljs'),
	path = require('path'),
	retriableWrap = require('../util/retriable-wrap'),
	destroyRole = require('../util/destroy-role');
module.exports = function destroy(options) {
	'use strict';
	var lambdaConfig, apiConfig;

	return loadConfig(options, { lambda: { name: true, region: true, role: true } })
		.then(function (config) {
			lambdaConfig = config.lambda;
			apiConfig = config.api;
		}).then(function () {
			var lambda = new aws.Lambda({ region: lambdaConfig.region });
			return lambda.deleteFunction({ FunctionName: lambdaConfig.name }).promise();
		}).then(function () {
			var apiGateway = retriableWrap(new aws.APIGateway({ region: lambdaConfig.region }));
			if (apiConfig) {
				return apiGateway.deleteRestApiPromise({
					restApiId: apiConfig.id
				});
			}
		}).then(function () {
			if (lambdaConfig.role) {
				return destroyRole(lambdaConfig.role);
			}
		}).then(function () {
			var sourceDir = (options && options.source) || shell.pwd().toString(),
				fileName = (options && options.config) || path.join(sourceDir, 'claudia.json');
			shell.rm(fileName);
		});
};
module.exports.doc = {
	description: 'Undeploy the lambda function and destroy the API and security roles',
	priority: 9,
	args: [
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
