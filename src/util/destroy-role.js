const aws = require('aws-sdk');
module.exports = function destroyRole(roleName) {
	'use strict';
	const iam = new aws.IAM(),
		deleteSinglePolicy = function (policyName) {
			return iam.deleteRolePolicy({
				PolicyName: policyName,
				RoleName: roleName
			}).promise();
		},
		detachSinglePolicy = function (policy) {
			return iam.detachRolePolicy({
				PolicyArn: policy.PolicyArn,
				RoleName: roleName
			}).promise();
		};
	return iam.listRolePolicies({RoleName: roleName}).promise()
	.then(result => Promise.all(result.PolicyNames.map(deleteSinglePolicy)))
	.then(() => iam.listAttachedRolePolicies({RoleName: roleName}).promise())
	.then(result => Promise.all(result.AttachedPolicies.map(detachSinglePolicy)))
	.then(() => iam.deleteRole({RoleName: roleName}).promise());
};
