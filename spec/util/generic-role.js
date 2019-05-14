/*global require */
const aws = require('aws-sdk'),
	templateFile = require('../../src/util/template-file'),
	destroyRole = require('../../src/util/destroy-role'),
	fsPromise = require('../../src/util/fs-promise.js'),
	awsRegion = require('./test-aws-region'),
	iam = new aws.IAM({region: awsRegion}),
	genericRoleName = 'test-generic-role-' + Date.now();

module.exports.create = function create(name) {
	'use strict';
	return fsPromise.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
		.then(lambdaRolePolicy => {
			return iam.createRole({
				RoleName: name || genericRoleName,
				AssumeRolePolicyDocument: lambdaRolePolicy
			}).promise();
		});
};
module.exports.destroy = function () {
	'use strict';
	return destroyRole(iam, genericRoleName);
};

module.exports.get = function () {
	'use strict';
	if (!genericRoleName) {
		throw 'Generic Role Not Created!';
	}
	return genericRoleName;
};
