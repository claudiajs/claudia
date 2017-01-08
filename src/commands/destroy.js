const aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	fsPromise = require('../util/fs-promise'),
	path = require('path'),
	retriableWrap = require('../util/retriable-wrap'),
	destroyRole = require('../util/destroy-role');
module.exports = function destroy(options) {
	'use strict';
	let lambdaConfig, apiConfig;

	return loadConfig(options, { lambda: { name: true, region: true, role: true } })
		.then(config => {
			lambdaConfig = config.lambda;
			apiConfig = config.api;
		})
		.then(() => {
			const lambda = new aws.Lambda({ region: lambdaConfig.region });
			return lambda.deleteFunction({ FunctionName: lambdaConfig.name }).promise();
		})
		.then(() => {
			const apiGateway = retriableWrap(new aws.APIGateway({ region: lambdaConfig.region }));
			if (apiConfig) {
				return apiGateway.deleteRestApiPromise({
					restApiId: apiConfig.id
				});
			}
		})
		.then(() => {
			if (lambdaConfig.role) {
				return destroyRole(lambdaConfig.role);
			}
		})
		.then(() => {
			const sourceDir = (options && options.source) || process.cwd(),
				fileName = (options && options.config) || path.join(sourceDir, 'claudia.json');
			return fsPromise.unlinkAsync(fileName);
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
