/*global describe, require, it, expect, beforeEach */
var underTest = require('../src/util/destroy-role'),
	addPolicy = require('../src/tasks/add-policy'),
	fs = require('../src/util/fs-promise'),
	aws = require('aws-sdk'),
	templateFile = require('../src/util/template-file');
describe('destroyRole', function () {
	'use strict';
	var testRunName, iam;
	beforeEach(function (done) {
		testRunName = 'test' + Date.now() + '-executor';
		iam = new aws.IAM();

		fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
		.then(function (lambdaRolePolicy) {
			return iam.createRole({
				RoleName: testRunName,
				AssumeRolePolicyDocument: lambdaRolePolicy
			}).promise();
		}).then(function () {
			return addPolicy('log-writer', testRunName);
		}).then(done, done.fail);
	});
	it('destroys the role', function (done) {
		underTest(testRunName).then(function () {
			return iam.getRole({ RoleName: testRunName }).promise();
		}).catch(function (expectedException) {
			expect(expectedException.code).toEqual('NoSuchEntity');
		}).then(done, done.fail);
	});
	it('destroys the policies', function (done) {
		underTest(testRunName).then(function () {
			return iam.listRolePolicies({ RoleName: testRunName}).promise();
		}).catch(function (expectedException) {
			expect(expectedException.message).toContain(testRunName);
		}).then(done, done.fail);
	});
});
