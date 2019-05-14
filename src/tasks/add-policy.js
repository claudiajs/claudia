const path = require('path'),
	fsPromise = require('../util/fs-promise');
module.exports = function addPolicy(iam, policyName, roleName, fileName) {
	'use strict';
	fileName = fileName || path.join(__dirname, '..', '..', 'json-templates', policyName + '.json');
	return fsPromise.readFileAsync(fileName, 'utf8')
		.then(policyContents => iam.putRolePolicy({
			RoleName: roleName,
			PolicyName: policyName,
			PolicyDocument: policyContents
		}).promise());
};
