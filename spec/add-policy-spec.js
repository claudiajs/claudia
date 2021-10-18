const underTest = require('../src/tasks/add-policy'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	awsRegion = require('./util/test-aws-region'),
	aws = require('aws-sdk'),
	path = require('path'),
	loggingPolicy = require('../src/policies/logging-policy'),
	fsPromise = require('../src/util/fs-promise'),
	lambdaRolePolicy = require('../src/policies/lambda-executor-policy');
describe('addPolicy', () => {
	'use strict';
	let testRunName, workingdir;
	const iam = new aws.IAM({ region: awsRegion });
	beforeEach(done => {
		workingdir = tmppath();


		testRunName = 'role-test' + Date.now();
		iam.createRole({
			RoleName: testRunName,
			AssumeRolePolicyDocument: lambdaRolePolicy()
		}).promise()
		.then(() => fsPromise.mkdirAsync(workingdir))
		.then(done, done.fail);
	});
	afterEach((done) => {
		destroyObjects({
			workingdir: workingdir,
			lambdaRole: testRunName
		}).then(done, done.fail);
	});
	it('appends a policy from a file to the role', done => {
		const policyPath = path.join(workingdir, 'policy1.json');
		fsPromise.writeFileAsync(policyPath, loggingPolicy('aws'), 'utf8')
		.then(() => underTest(iam, 'log-writer', testRunName, policyPath))
		.then(() =>
			iam.getRolePolicy({
				PolicyName: 'log-writer',
				RoleName: testRunName
			}).promise()
		)
		.then(policy => {
			const parsedPolicy = JSON.parse(decodeURIComponent(policy.PolicyDocument)),
				expectedPolicy = JSON.parse(loggingPolicy('aws'));
			expect(parsedPolicy).toEqual(expectedPolicy);
		})
		.then(done, done.fail);
	});
});
