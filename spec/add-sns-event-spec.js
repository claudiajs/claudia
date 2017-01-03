/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine, Promise */
var underTest = require('../src/commands/add-sns-event-source'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	retry = require('oh-no-i-insist'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	awsRegion = require('./helpers/test-aws-region');
describe('addSNSEventSource', function () {
	'use strict';
	var workingdir, testRunName, newObjects, config, logs, lambda, sns;
	beforeEach(function () {
		workingdir = tmppath();
		logs = new aws.CloudWatchLogs({region: awsRegion});
		lambda = new aws.Lambda({region: awsRegion});
		sns = new aws.SNS({region: awsRegion});
		testRunName = 'test' + Date.now();
		newObjects = {workingdir: workingdir};
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 50000;
		shell.mkdir(workingdir);
		config = {
			topic: 'test-topic',
			source: workingdir
		};
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).then(done);
	});
	it('fails when the topic is not defined in options', function (done) {
		config.topic = '';
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('SNS topic not specified. please provide it with --topic');
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
				});
			};
		beforeEach(function (done) {
			createConfig = {name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'};
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			sns.createTopic({
				Name: testRunName + '-topic'
			}).promise().then(function (result) {
				newObjects.snsTopic = result.TopicArn;
				config.topic = result.TopicArn;
			}).then(done);
		});
		it('sets up privileges and rule notifications if no version given', function (done) {
			var functionArn;
			createLambda()
			.then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName
				}).promise();
			}).then(function (lambdaResult) {
				functionArn = lambdaResult.FunctionArn;
			}).then(function () {
				return underTest(config);
			}).then(function () {
				return sns.listSubscriptionsByTopic({TopicArn: config.topic}).promise();
			}).then(function (config) {
				expect(config.Subscriptions.length).toBe(1);
				expect(config.Subscriptions[0].Endpoint).toEqual(functionArn);
			}).then(done, done.fail);
		});
		it('invokes lambda from SNS when no version is given', function (done) {
			createLambda()
			.then(function () {
				return underTest(config);
			}).then(function () {
				return sns.publish({
					Message: JSON.stringify({name: 'Mike'}),
					TopicArn: config.topic
				}).promise();
			}).then(function () {
				return retry(function () {
					console.log('trying to get events from ' + '/aws/lambda/' + testRunName);
					return logs.filterLogEvents({logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'aws sns EventSubscription'})
						.promise()
						.then(function (logEvents) {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 5000, 5, undefined, undefined, Promise);
			}).then(done, done.fail);
		});

		it('binds to an alias, if the version is provided', function (done) {
			var functionArn;
			createConfig.version = 'special';
			config.version = 'special';
			createLambda()
			.then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'special'
				}).promise();
			}).then(function (lambdaResult) {
				functionArn = lambdaResult.FunctionArn;
			}).then(function () {
				return underTest(config);
			}).then(function () {
				return sns.listSubscriptionsByTopic({TopicArn: config.topic}).promise();
			}).then(function (config) {
				expect(config.Subscriptions.length).toBe(1);
				expect(config.Subscriptions[0].Endpoint).toEqual(functionArn);
			}).then(done, done.fail);
		});
		it('invokes lambda from SNS when version is provided', function (done) {
			createConfig.version = 'special';
			config.version = 'special';
			createLambda()
			.then(function () {
				return underTest(config);
			}).then(function () {
				return sns.publish({
					Message: JSON.stringify({name: 'Mike'}),
					TopicArn: config.topic
				}).promise();
			}).then(function () {
				return retry(function () {
					console.log('trying to get events from ' + '/aws/lambda/' + testRunName);
					return logs.filterLogEvents({logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'aws sns EventSubscription'})
						.promise()
						.then(function (logEvents) {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 5000, 5);
			}).then(done, done.fail);
		});

	});
});
