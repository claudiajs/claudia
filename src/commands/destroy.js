/*global module, require */
var Promise = require('bluebird'),
aws = require('aws-sdk'),
loadConfig = require('../util/loadconfig');
module.exports = function destroy(options) {
	'use strict';
	var lambdaConfig, apiConfig,
		iam = Promise.promisifyAll(new aws.IAM()),
		destroyRole = function (roleName) {
			var deleteSinglePolicy = function (policyName) {
				return iam.deleteRolePolicyAsync({
					PolicyName: policyName,
					RoleName: roleName
				});
			};
			return iam.listRolePoliciesAsync({ RoleName: roleName }).then(function (result) {
				return Promise.map(result.PolicyNames, deleteSinglePolicy);
			}).then(function () {
				return iam.deleteRoleAsync({ RoleName: roleName });
			});
		};

	return loadConfig(options, { lambda: { name: true, region: true, role: true } })
		.then(function (config) {
			lambdaConfig = config.lambda;
			apiConfig = config.api;
		}).then(function () {
			var lambda = Promise.promisifyAll(new aws.Lambda({ region: lambdaConfig.region }), { suffix: 'Promise' });
			return lambda.deleteFunctionPromise({ FunctionName: lambdaConfig.name });
		}).then(function () {
			var apiGateway = Promise.promisifyAll(new aws.APIGateway({ region: lambdaConfig.region }));
			if (apiConfig) {
				return apiGateway.deleteRestApiAsync({
					restApiId: apiConfig.id
				});
			}
		}).then(function () {
			if (lambdaConfig.role) {
				return destroyRole(lambdaConfig.role);
			}
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
