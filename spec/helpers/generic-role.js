/*global beforeAll, afterAll, require, beforeEach, console*/
var aws = require('aws-sdk'),
	Promise = require('bluebird'),
	iam = Promise.promisifyAll(new aws.IAM()),
	templateFile = require('../../src/util/template-file'),
	fs = Promise.promisifyAll(require('fs')),
	genericRoleName,
	destroyRole = function (roleName) {
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
beforeAll(function (done) {
	'use strict';
	genericRoleName = 'role-' + Date.now();
	fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
		.then(function (lambdaRolePolicy) {
			return iam.createRoleAsync({
				RoleName: genericRoleName,
				AssumeRolePolicyDocument: lambdaRolePolicy
			});
		}).then(done, function (x) {
			console.log(x);
			done.fail(x);
		});
});
beforeEach(function () {
	'use strict';
	this.genericRole = genericRoleName;
});
afterAll(function (done) {
	'use strict';
	destroyRole(genericRoleName).then(done, function () {
		console.log('error destroying generic role', genericRoleName);
		done();
	});
});
