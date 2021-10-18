const aws = require('aws-sdk'),
	destroyRole = require('../../src/util/destroy-role'),
	awsRegion = require('./test-aws-region'),
	iam = new aws.IAM({region: awsRegion}),
	genericRoleName = 'test-generic-role-' + Date.now();

module.exports.create = function create(name) {
	'use strict';
	const lambdaRolePolicy = JSON.stringify({
		'Version': '2012-10-17',
		'Statement': [{
			'Effect': 'Allow',
			'Principal': {'Service': 'lambda.amazonaws.com'},
			'Action': 'sts:AssumeRole'
		}]
	});
	return iam.createRole({
		RoleName: name || genericRoleName,
		AssumeRolePolicyDocument: lambdaRolePolicy
	}).promise();
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
