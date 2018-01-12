/*global describe, it, expect, beforeEach */
const underTest = require('../src/util/destroy-role'),
	addPolicy = require('../src/tasks/add-policy'),
	fsPromise = require('../src/util/fs-promise'),
	aws = require('aws-sdk'),
	templateFile = require('../src/util/template-file');
describe('destroyRole', () => {
	'use strict';
	let testRunName, iam;
	beforeEach(done => {
		testRunName = `test${Date.now()}-executor`;
		iam = new aws.IAM();

		fsPromise.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
		.then(lambdaRolePolicy => {
			return iam.createRole({
				RoleName: testRunName,
				AssumeRolePolicyDocument: lambdaRolePolicy
			}).promise();
		})
		.then(() => addPolicy('log-writer', testRunName))
		.then(done, done.fail);
	});
	it('destroys the role', done => {
		underTest(testRunName)
		.then(() => iam.getRole({ RoleName: testRunName }).promise())
		.catch(expectedException => expect(expectedException.code).toEqual('NoSuchEntity'))
		.then(done, done.fail);
	});
	it('destroys the policies', done => {
		underTest(testRunName)
		.then(() => iam.listRolePolicies({ RoleName: testRunName }).promise())
		.catch(expectedException => expect(expectedException.message).toContain(testRunName))
		.then(done, done.fail);
	});
	it('destroys a role with attached policies', done => {
		iam.attachRolePolicy({
			RoleName: testRunName,
			PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaKinesisExecutionRole'
		}).promise()
		.then(() => underTest(testRunName))
		.then(() => iam.getRole({ RoleName: testRunName }).promise())
		.catch(expectedException => expect(expectedException.code).toEqual('NoSuchEntity'))
		.then(done, done.fail);
	});
});
