/*global describe, it, expect, beforeEach */
const underTest = require('../src/util/destroy-role'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region');
describe('destroyRole', () => {
	'use strict';
	let testRunName, iam;
	beforeEach(done => {
		const executorPolicy = JSON.stringify({
				'Version': '2012-10-17',
				'Statement': [{
					'Effect': 'Allow',
					'Principal': {'Service': 'lambda.amazonaws.com'},
					'Action': 'sts:AssumeRole'
				}]
			}),
			loggingPolicy = JSON.stringify({
				'Version': '2012-10-17',
				'Statement': [
					{
						'Effect': 'Allow',
						'Action': [
							'logs:CreateLogGroup',
							'logs:CreateLogStream',
							'logs:PutLogEvents'
						],
						'Resource': `arn:aws:logs:*:*:*`
					}
				]
			});
		testRunName = `test${Date.now()}-executor`;
		iam = new aws.IAM({region: awsRegion});

		iam.createRole({
			RoleName: testRunName,
			AssumeRolePolicyDocument: executorPolicy
		}).promise()
		.then(() => iam.putRolePolicy({
			RoleName: testRunName,
			PolicyName: 'log-writer',
			PolicyDocument: loggingPolicy
		}).promise())
		.then(done, done.fail);
	});
	it('destroys the role', done => {
		underTest(iam, testRunName)
		.then(() => iam.getRole({ RoleName: testRunName }).promise())
		.catch(expectedException => expect(expectedException.code).toEqual('NoSuchEntity'))
		.then(done, done.fail);
	});
	it('destroys the policies', done => {
		underTest(iam, testRunName)
		.then(() => iam.listRolePolicies({ RoleName: testRunName }).promise())
		.catch(expectedException => expect(expectedException.message).toContain(testRunName))
		.then(done, done.fail);
	});
	it('destroys a role with attached policies', done => {
		iam.attachRolePolicy({
			RoleName: testRunName,
			PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaKinesisExecutionRole'
		}).promise()
		.then(() => underTest(iam, testRunName))
		.then(() => iam.getRole({ RoleName: testRunName }).promise())
		.catch(expectedException => expect(expectedException.code).toEqual('NoSuchEntity'))
		.then(done, done.fail);
	});
});
