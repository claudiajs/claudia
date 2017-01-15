/*global require */
const aws = require('aws-sdk'),
	iam = new aws.IAM(),
	templateFile = require('../../src/util/template-file'),
	destroyRole = require('../../src/util/destroy-role'),
	fs = require('../../src/util/fs-promise.js'),
	genericRoleName = 'test-generic-role-' + Date.now();

module.exports.create = function create() {
	'use strict';
	return fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
		.then(lambdaRolePolicy => {
			return iam.createRole({
				RoleName: genericRoleName,
				AssumeRolePolicyDocument: lambdaRolePolicy
			}).promise();
		});
};
module.exports.destroy = function () {
	'use strict';
	return destroyRole(genericRoleName);
};

module.exports.get = function () {
	'use strict';
	if (!genericRoleName) {
		throw 'Generic Role Not Created!';
	}
	return genericRoleName;
};
