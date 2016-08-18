/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine */
var underTest = require('../src/commands/add-scheduled-event'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('addScheduledEvent', function () {
	'use strict';
	var workingdir, testRunName, newObjects, s3, config, events, lambda, eventConfig;
	beforeEach(function () {
		var eventFile;
		workingdir = tmppath();
		s3 = Promise.promisifyAll(new aws.S3());
		events = Promise.promisifyAll(new aws.CloudWatchEvents({region: awsRegion}));
		lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'});
		testRunName = 'test' + Date.now();
		newObjects = {workingdir: workingdir};
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
		shell.mkdir(workingdir);
		eventFile = path.join(workingdir, 'test-event.json');
		eventConfig = {
			name: 'Mike'
		};
		fs.writeFileSync(eventFile, JSON.stringify(eventConfig), 'utf8');
		config = {
			event: eventFile,
			source: workingdir,
			name: testRunName + '-scheduled-event',
			schedule: 'rate(5 minutes)'
		};

	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	it('fails when the event file is not defined in options', function (done) {
		config.event = '';
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('event file not specified. please provide it with --event');
			done();
		});
	});
	it('fails when the event name is not defined in options', function (done) {
		config.name = '';
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('event name not specified. please provide it with --name');
			done();
		});
	});
	it('fails when the event schedule is not defined in options', function (done) {
		config.schedule = '';
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('event schedule not specified. please provide it with --schedule');
			done();
		});
	});

	it('fails when the source dir does not contain the project config file', function (done) {
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	describe('when params are valid', function () {
		var createConfig,
			createLambda = function () {
				return create(createConfig).then(function (result) {
					newObjects.lambdaRole = result.lambda && result.lambda.role;
					newObjects.lambdaFunction = result.lambda && result.lambda.name;
					newObjects.eventRule = testRunName + '-scheduled-event';
				});
			};
		beforeEach(function () {
			createConfig = {name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'};
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
		});
		it('uses the schedule expression to configure the rule', function (done) {
			createLambda()
			.then(function () {
				return underTest(config);
			}).then(function () {
				return events.describeRuleAsync({
					Name: newObjects.eventRule
				});
			}).then(function (eventConfig) {
				expect(eventConfig.State).toEqual('ENABLED');
				expect(eventConfig.ScheduleExpression).toEqual('rate(5 minutes)');
			}).then(done, done.fail);
		});
		it('uses the rate argument as a shorthand for the schedule expression', function (done) {
			config.schedule = '';
			config.rate = '10 minutes';
			createLambda()
			.then(function () {
				return underTest(config);
			}).then(function () {
				return events.describeRuleAsync({
					Name: newObjects.eventRule
				});
			}).then(function (eventConfig) {
				expect(eventConfig.State).toEqual('ENABLED');
				expect(eventConfig.ScheduleExpression).toEqual('rate(10 minutes)');
			}).then(done, done.fail);
		});
		it('uses the cron argument as a shorthand for the schedule expression', function (done) {
			config.schedule = '';
			config.cron = '0 8 1 * ? *';
			createLambda()
			.then(function () {
				return underTest(config);
			}).then(function () {
				return events.describeRuleAsync({
					Name: newObjects.eventRule
				});
			}).then(function (eventConfig) {
				expect(eventConfig.State).toEqual('ENABLED');
				expect(eventConfig.ScheduleExpression).toEqual('cron(0 8 1 * ? *)');
			}).then(done, done.fail);
		});
		it('sets up privileges and rule notifications', function (done) {
			var functionArn;

			createLambda()
			.then(function () {
				return lambda.getFunctionConfigurationPromise({
					FunctionName: testRunName
				});
			}).then(function (lambdaResult) {
				functionArn = lambdaResult.FunctionArn;
			}).then(function () {
				return underTest(config);
			}).then(function () {
				return events.listTargetsByRuleAsync({Rule: config.name});
			}).then(function (config) {
				expect(config.Targets.length).toBe(1);
				expect(config.Targets[0].Arn).toEqual(functionArn);
				expect(eventConfig).toEqual(JSON.parse(config.Targets[0].Input));
			}).then(done, done.fail);
		});
		it('binds to an alias, if the version is provided', function (done) {
			var functionArn;
			createConfig.version = 'special';
			config.version = 'special';

			createLambda()
			.then(function () {
				return lambda.getFunctionConfigurationPromise({
					FunctionName: testRunName,
					Qualifier: 'special'
				});
			}).then(function (lambdaResult) {
				functionArn = lambdaResult.FunctionArn;
				console.log(functionArn);
			}).then(function () {
				return underTest(config);
			}).then(function () {
				return events.listTargetsByRuleAsync({Rule: config.name});
			}).then(function (config) {
				expect(config.Targets.length).toBe(1);
				expect(config.Targets[0].Arn).toEqual(functionArn);
				expect(eventConfig).toEqual(JSON.parse(config.Targets[0].Input));
			}).then(done, done.fail);
		});
	});
});
