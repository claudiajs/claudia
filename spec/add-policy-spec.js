/*global describe, it, expect, beforeEach, afterEach  */
const underTest = require('../src/tasks/add-policy'),
	destroyObjects = require('./util/destroy-objects'),
	aws = require('aws-sdk');
describe('addPolicy', () => {
	'use strict';
	let testRunName;
	const iam = new aws.IAM(),
		lambdaRolePolicy = {
			Version: '2012-10-17',
			Statement: [{
				Effect: 'Allow',
				Principal: {
					Service: 'lambda.amazonaws.com'
				},
				Action: 'sts:AssumeRole'
			}]
		};
	beforeEach(done => {
		testRunName = 'role-test' + Date.now();
		iam.createRole({
			RoleName: testRunName,
			AssumeRolePolicyDocument: JSON.stringify(lambdaRolePolicy)
		}).promise()
		.then(done, done.fail);
	});
	afterEach((done) => {
		destroyObjects({ lambdaRole: testRunName }).then(done, done.fail);
	});
	it('appends a policy from the templates folder to the role', done => {
		const expectedPolicy = require('../json-templates/log-writer');
		underTest('log-writer', testRunName)
		.then(() =>
			iam.getRolePolicy({
				PolicyName: 'log-writer',
				RoleName: testRunName
			}).promise()
		)
		.then(policy => expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(expectedPolicy))
		.then(done, done.fail);
	});
});
