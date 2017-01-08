const aws = require('aws-sdk'),
	iam = new aws.IAM();
module.exports = function destroyRole(roleName) {
	'use strict';
	const deleteSinglePolicy = function (policyName) {
		return iam.deleteRolePolicy({
			PolicyName: policyName,
			RoleName: roleName
		}).promise();
	};
	return iam.listRolePolicies({RoleName: roleName}).promise()
	.then(result => Promise.all(result.PolicyNames.map(deleteSinglePolicy)))
	.then(() => iam.deleteRole({RoleName: roleName}).promise());
};
