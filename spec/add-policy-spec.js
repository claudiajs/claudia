/*global describe, require, it, expect, beforeEach, afterEach  */
var underTest = require('../src/tasks/add-policy'),
	aws = require('aws-sdk');
describe('add-policy', function () {
	'use strict';
	var testRunName,
		iam = new aws.IAM(),
		lambdaRolePolicy = {
			'Version': '2012-10-17',
			'Statement': [{
				'Effect': 'Allow',
				'Principal': {
					'Service': 'lambda.amazonaws.com'
				},
				'Action': 'sts:AssumeRole'
			}]
		};
	beforeEach(function (done) {
		testRunName = 'role-test' + Date.now();
		iam.createRole({
			RoleName: testRunName,
			AssumeRolePolicyDocument: JSON.stringify(lambdaRolePolicy)
		}).promise().then(done, done.fail);
	});
	afterEach(function (done) {
		this.destroyObjects({lambdaRole: testRunName}).then(done, done.fail);
	});
	it('appends a policy from the templates folder to the role', function (done) {
		var expectedPolicy = require('../json-templates/log-writer');
		underTest('log-writer', testRunName).then(function () {
			return iam.getRolePolicy({
				PolicyName: 'log-writer',
				RoleName: testRunName
			}).promise();
		}).then(function (policy) {
			expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(expectedPolicy);
		}).then(done, done.fail);
	});
});
