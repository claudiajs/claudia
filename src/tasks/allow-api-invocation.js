/*global require, module*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	find = require('../util/find');
module.exports = function allowApiInvocation(functionName, functionVersion, restApiId, ownerId, awsRegion, path) {
	'use strict';
	var lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'}),
		activePath = path || '*/*/*',
		policy = {
			Action: 'lambda:InvokeFunction',
			FunctionName: functionName,
			Principal: 'apigateway.amazonaws.com',
			SourceArn: 'arn:aws:execute-api:' + awsRegion + ':' + ownerId + ':' + restApiId + '/' + activePath,
			Qualifier: functionVersion,
			StatementId: 'web-api-access-' + functionVersion + '-' + Date.now()
		},
		matchesPolicy = function (statement) {
			return statement.Action === policy.Action &&
				statement.Principal && statement.Principal.Service ===  policy.Principal &&
				statement.Condition && statement.Condition.ArnLike &&
				statement.Condition.ArnLike['AWS:SourceArn'] === policy.SourceArn &&
				statement.Effect === 'Allow';
		};
	return lambda.getPolicyPromise({
		FunctionName: functionName,
		Qualifier: functionVersion
	}).then(function (policyResponse) {
		return policyResponse && policyResponse.Policy && JSON.parse(policyResponse.Policy);
	}).then(function (currentPolicy) {
		var statements = (currentPolicy && currentPolicy.Statement) || [];
		if (!find(statements, matchesPolicy)) {
			return lambda.addPermissionPromise(policy);
		}
	}, function (e) {
		if (e && e.code === 'ResourceNotFoundException') {
			return lambda.addPermissionPromise(policy);
		} else {
			return Promise.reject(e);
		}
	});
};
