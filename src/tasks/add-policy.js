const fsPromise = require('../util/fs-promise');
module.exports = function addPolicy(iam, policyName, roleName, fileName) {
	'use strict';
	return fsPromise.readFileAsync(fileName, 'utf8')
		.then(policyContents => iam.putRolePolicy({
			RoleName: roleName,
			PolicyName: policyName,
			PolicyDocument: policyContents
		}).promise());
};
