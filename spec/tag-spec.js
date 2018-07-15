/*global describe, it, expect, beforeEach, afterEach	*/
const underTest = require('../src/commands/tag'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	fsUtil = require('../src/util/fs-util'),
	fs = require('fs'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region');
describe('tag', () => {
	'use strict';
	let workingdir, testRunName, newObjects, lambda;
	beforeEach(() => {
		workingdir = tmppath();
		lambda = new aws.Lambda({region: awsRegion});
		testRunName = 'test' + Date.now();
		newObjects = {workingdir: workingdir};
		fs.mkdirSync(workingdir);
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the source dir does not contain the project config file', done => {
		underTest({tags: 'Team=onboarding'})
		.then(done.fail, reason => {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('appends tags from csv', done => {
		create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' }).then(result => {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		})
		.then(() => underTest({tags: 'Team=onboarding', source: workingdir}))
		.then(() => {
			return lambda.getFunctionConfiguration({
				FunctionName: testRunName
			}).promise();
		})
		.then(lambdaResult => {
			return lambda.listTags({ Resource: lambdaResult.FunctionArn }).promise();
		})
		.then(data => expect(data.Tags).toEqual({ Team: 'onboarding' }))
		.then(done, done.fail);
	});
});
