const loadConfig = require('../util/loadconfig'), fsPromise = require('../util/fs-promise'), path = require('path'), retriableWrap = require('../util/retriable-wrap'), destroyRole = require('../util/destroy-role');

const {
    APIGateway
} = require("@aws-sdk/client-api-gateway");

const {
    IAM
} = require("@aws-sdk/client-iam");

const {
    Lambda
} = require("@aws-sdk/client-lambda");

module.exports = function destroy(options) {
	'use strict';
	let lambdaConfig, apiConfig;

	return loadConfig(options, { lambda: { name: true, region: true, role: true } })
		.then(config => {
			lambdaConfig = config.lambda;
			apiConfig = config.api;
		})
		.then(() => {
			const lambda = new Lambda({
                region: lambdaConfig.region
            });
			return lambda.deleteFunction({ FunctionName: lambdaConfig.name });
		})
		.then(() => {
			const apiGateway = retriableWrap(new APIGateway({
                region: lambdaConfig.region
            }));
			if (apiConfig) {
				return apiGateway.deleteRestApiPromise({
					restApiId: apiConfig.id
				});
			}
		})
		.then(() => {
			const iam = new IAM({
                region: lambdaConfig.region
            });
			if (lambdaConfig.role && !lambdaConfig.sharedRole) {
				return destroyRole(iam, lambdaConfig.role);
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
