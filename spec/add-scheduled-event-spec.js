/*global describe, it, expect, beforeEach, afterEach */
const underTest = require('../src/commands/add-scheduled-event'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	fsUtil = require('../src/util/fs-util'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region');
describe('addScheduledEvent', () => {
	'use strict';
	let workingdir, testRunName, newObjects, config, events, lambda, eventConfig;
	beforeEach(() => {
		workingdir = tmppath();
		events = new aws.CloudWatchEvents({region: awsRegion});
		lambda = new aws.Lambda({region: awsRegion});
		testRunName = 'test' + Date.now();
		newObjects = {workingdir: workingdir};
		fs.mkdirSync(workingdir);
		const eventFile = path.join(workingdir, 'test-event.json');
		eventConfig = {
			name: 'Mike'
		};
		fs.writeFileSync(eventFile, JSON.stringify(eventConfig), 'utf8');
		config = {
			event: eventFile,
			source: workingdir,
			name: `${testRunName}-scheduled-event`,
			schedule: 'rate(5 minutes)'
		};
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the event file is not defined in options', done => {
		config.event = '';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('event file not specified. please provide it with --event');
			done();
		});
	});
	it('fails when the event name is not defined in options', done => {
		config.name = '';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('event name not specified. please provide it with --name');
			done();
		});
	});
	it('fails when the event schedule is not defined in options', done => {
		config.schedule = '';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('event schedule not specified. please provide it with --schedule');
			done();
		});
	});
	it('fails when the source dir does not contain the project config file', done => {
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	describe('when params are valid', () => {
		let createConfig;
		const createLambda = function () {
			return create(createConfig).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.eventRule = `${testRunName}-scheduled-event`;
			});
		};
		beforeEach(() => {
			createConfig = { name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' };
			fsUtil.copy('spec/test-projects/echo', workingdir, true);
		});
		it('uses the schedule expression to configure the rule', done => {
			createLambda()
			.then(() => underTest(config))
			.then(() => {
				return events.describeRule({
					Name: newObjects.eventRule
				}).promise();
			})
			.then(eventConfig => {
				expect(eventConfig.State).toEqual('ENABLED');
				expect(eventConfig.ScheduleExpression).toEqual('rate(5 minutes)');
			})
			.then(done, done.fail);
		});
		it('uses the rate argument as a shorthand for the schedule expression', done => {
			config.schedule = '';
			config.rate = '10 minutes';
			createLambda()
			.then(() => underTest(config))
			.then(() => {
				return events.describeRule({
					Name: newObjects.eventRule
				}).promise();
			})
			.then(eventConfig => {
				expect(eventConfig.State).toEqual('ENABLED');
				expect(eventConfig.ScheduleExpression).toEqual('rate(10 minutes)');
			})
			.then(done, done.fail);
		});
		it('uses the cron argument as a shorthand for the schedule expression', done => {
			config.schedule = '';
			config.cron = '0 8 1 * ? *';
			createLambda()
			.then(() => underTest(config))
			.then(() => {
				return events.describeRule({
					Name: newObjects.eventRule
				}).promise();
			})
			.then(eventConfig => {
				expect(eventConfig.State).toEqual('ENABLED');
				expect(eventConfig.ScheduleExpression).toEqual('cron(0 8 1 * ? *)');
			})
			.then(done, done.fail);
		});
		it('sets up privileges and rule notifications', done => {
			let functionArn;

			createLambda()
			.then(() => {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName
				}).promise();
			})
			.then(lambdaResult => {
				functionArn = lambdaResult.FunctionArn;
			})
			.then(() => underTest(config))
			.then(() => events.listTargetsByRule({Rule: config.name}).promise())
			.then(config => {
				expect(config.Targets.length).toBe(1);
				expect(config.Targets[0].Arn).toEqual(functionArn);
				expect(eventConfig).toEqual(JSON.parse(config.Targets[0].Input));
			})
			.then(done, done.fail);
		});
		it('binds to an alias, if the version is provided', done => {
			let functionArn;
			createConfig.version = 'special';
			config.version = 'special';

			createLambda()
			.then(() => {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'special'
				}).promise();
			})
			.then(lambdaResult => {
				functionArn = lambdaResult.FunctionArn;
				console.log(functionArn);
			})
			.then(() => underTest(config))
			.then(() => events.listTargetsByRule({Rule: config.name}).promise())
			.then(config => {
				expect(config.Targets.length).toBe(1);
				expect(config.Targets[0].Arn).toEqual(functionArn);
				expect(eventConfig).toEqual(JSON.parse(config.Targets[0].Input));
			})
			.then(done, done.fail);
		});
	});
});
