/*global module, require */
var	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	iam = Promise.promisifyAll(new aws.IAM());
module.exports = function destroyRole(roleName) {
	'use strict';
	var deleteSinglePolicy = function (policyName) {
		return iam.deleteRolePolicyAsync({
			PolicyName: policyName,
			RoleName: roleName
		});
	};
	return iam.listRolePoliciesAsync({RoleName: roleName}).then(function (result) {
		return Promise.map(result.PolicyNames, deleteSinglePolicy);
	}).then(function () {
		return iam.deleteRoleAsync({RoleName: roleName});
	});
};
