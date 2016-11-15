/*global module, require, Promise */
var aws = require('aws-sdk'),
	iam = new aws.IAM();
module.exports = function destroyRole(roleName) {
	'use strict';
	var deleteSinglePolicy = function (policyName) {
		return iam.deleteRolePolicy({
			PolicyName: policyName,
			RoleName: roleName
		}).promise();
	};
	return iam.listRolePolicies({RoleName: roleName}).promise().then(function (result) {
		return Promise.all(result.PolicyNames.map(deleteSinglePolicy));
	}).then(function () {
		return iam.deleteRole({RoleName: roleName}).promise();
	});
};

