/*global beforeAll, afterAll, require, beforeEach, console */
var aws = require('aws-sdk'),
	iam = new aws.IAM(),
	templateFile = require('../../src/util/template-file'),
	destroyRole = require('../../src/util/destroy-role'),
	fs = require('../../src/util/fs-promise.js'),
	genericRoleName;
beforeAll(function (done) {
	'use strict';
	genericRoleName = 'test-generic-role-' + Date.now();
	fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
		.then(function (lambdaRolePolicy) {
			return iam.createRole({
				RoleName: genericRoleName,
				AssumeRolePolicyDocument: lambdaRolePolicy
			}).promise();
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
