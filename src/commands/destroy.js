/*global module, require*/
var Promise = require('bluebird'),
    aws = require('aws-sdk'),
    loadConfig = require('../util/loadconfig');
module.exports = function destroy(options) {
    'use strict';
    var lambda, lambdaConfig, apiConfig, deleteFunction,
        iam = Promise.promisifyAll(new aws.IAM()),
        destroyRole = function(roleName) {
            var deleteSinglePolicy = function(policyName) {
                return iam.deleteRolePolicyAsync({
                    PolicyName: policyName,
                    RoleName: roleName
                });
            };
            return iam.listRolePoliciesAsync({ RoleName: roleName }).then(function(result) {
                return Promise.map(result.PolicyNames, deleteSinglePolicy);
            }).then(function() {
                return iam.deleteRoleAsync({ RoleName: roleName });
            });
        };

    return loadConfig(options, { lambda: { name: true, region: true, role: true } }).then(function(config) {
        lambdaConfig = config.lambda;
        apiConfig = config.api;
        console.log(config);
    }).then(function() {
        lambda = Promise.promisifyAll(new aws.Lambda({ region: lambdaConfig.region }), { suffix: 'Promise' });
        deleteFunction = Promise.promisify(lambda.deleteFunction.bind(lambda));
        return deleteFunction({ FunctionName: lambdaConfig.name });
    }).then(function() {
        if(!apiConfig){
            return Promise.resolve(true);
        }
        var apiGateway = Promise.promisifyAll(new aws.APIGateway({ region: lambdaConfig.region }));
        return apiGateway.deleteRestApiAsync({
            restApiId: apiConfig.id
        });
    }).then(function() {
        if (lambdaConfig.role) {
            return destroyRole(lambdaConfig.role);
        }
    });
};
