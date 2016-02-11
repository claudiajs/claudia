/*global describe, require, it, expect, beforeEach, afterEach  */
var underTest = require('../src/tasks/add-policy'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	destroyRole = require('../src/util/destroy-role');
describe('add-policy', function () {
	'use strict';
	var testRunName,
		iam = Promise.promisifyAll(new aws.IAM()),
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
		iam.createRoleAsync({
			RoleName: testRunName,
			AssumeRolePolicyDocument: JSON.stringify(lambdaRolePolicy)
		}).then(done, done.fail);
	});
	afterEach(function (done) {
		destroyRole(testRunName).then(done, done.fail);
	});
	it('appends a policy from the templates folder to the role', function (done) {
		var expectedPolicy = require('../json-templates/log-writer');
		underTest('log-writer', testRunName).then(function () {
			return iam.getRolePolicyAsync({
				PolicyName: 'log-writer',
				RoleName: testRunName
			});
		}).then(function (policy) {
			expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(expectedPolicy);
		}).then(done, done.fail);
	});
});
