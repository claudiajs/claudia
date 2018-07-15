/*global describe, it, expect, beforeEach, afterEach */
const underTest = require('../src/commands/allow-alexa-skill-trigger'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	awsRegion = require('./util/test-aws-region');

describe('allowAlexaSkillTrigger', () => {
	'use strict';

	let workingdir, testRunName, newObjects, lambda;
	beforeEach(() => {
		workingdir = tmppath();
		lambda = new aws.Lambda({ region: awsRegion });
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		fs.mkdirSync(workingdir);
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('allows Alexa Skill to trigger Lambda', done => {
		const createConfig = {
				name: testRunName,
				region: awsRegion,
				source: workingdir,
				handler: 'main.handler',
				version: 'dev'
			},
			config = {
				source: workingdir,
				version: 'dev'
			};
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		create(createConfig)
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest(config))
			.then(() => lambda.getPolicy({ FunctionName: testRunName, Qualifier: 'dev' }).promise())
			.then(result => JSON.parse(result.Policy).Statement[0])
			.then(statement => {
				expect(statement.Effect).toEqual('Allow');
				expect(statement.Principal.Service).toEqual('alexa-appkit.amazon.com');
				expect(statement.Action).toEqual('lambda:InvokeFunction');
			})
			.then(done, done.fail);
	});
});
