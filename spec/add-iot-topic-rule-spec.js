/*global describe, it, expect, beforeEach, afterEach */
const underTest = require('../src/commands/add-iot-topic-rule'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	path = require('path'),
	aws = require('aws-sdk'),
	pollForLogEvents = require('./util/poll-for-log-events'),
	awsRegion = require('./util/test-aws-region');
describe('addIOTTopicRuleEventSource', () => {
	'use strict';
	let workingdir, testRunName, newObjects, config, lambda, iot;
	const postToEndpoint = function (endpoint, topic, message) {
			const iotdata = new aws.IotData({region: awsRegion, endpoint: endpoint});
			return iotdata.publish({
				topic: topic,
				payload: message
			}).promise();
		},
		postToDefaultEndpoint = function (topic, message) {
			return iot.describeEndpoint().promise().then(data => postToEndpoint(data.endpointAddress, topic, message));
		};
	beforeEach(() => {
		workingdir = tmppath();
		lambda = new aws.Lambda({ region: awsRegion });
		iot = new aws.Iot({region: awsRegion});
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		fs.mkdirSync(workingdir);
		config = {
			sql: 'SELECT * FROM \'iot/+\'',
			source: workingdir
		};
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the topic is not defined in options', done => {
		config.sql = '';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('SQL statement not specified. please provide it with --sql');
			done();
		});
	});
	it('fails when the source dir does not contain the project config file', done => {
		underTest(config).then(done.fail, reason => {
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
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({ lambda: { name: 'xxx' } }), 'utf8');
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});

	describe('when params are valid', () => {
		let createConfig;
		const createLambda = function () {
			return create(createConfig)
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			});
		};
		beforeEach(() => {
			createConfig = { name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' };
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		});
		it('sets up privileges and rule notifications if no version given', done => {
			let functionArn;
			createLambda()
			.then(() => lambda.getFunctionConfiguration({ FunctionName: testRunName }).promise())
			.then(lambdaResult => functionArn = lambdaResult.FunctionArn)
			.then(() => underTest(config))
			.then(result => newObjects.iotTopicRule = result.ruleName)
			.then(ruleName => iot.getTopicRule({ruleName: ruleName}).promise())
			.then(topicRule => {
				expect(topicRule.rule.sql).toEqual('SELECT * FROM \'iot/+\'');
				expect(topicRule.rule.awsIotSqlVersion).toEqual('2015-10-08');
				expect(topicRule.rule.actions).toEqual([{lambda: { functionArn: functionArn } }]);
			})
			.then(done, done.fail);
		});

		it('invokes lambda from IOT when no version is given', done => {
			createLambda()
			.then(() => underTest(config))
			.then(result => newObjects.iotTopicRule = result.ruleName)
			.then(() => postToDefaultEndpoint('iot/987', JSON.stringify({message: 'Hello From ' + testRunName})))
			.then(() => pollForLogEvents(`/aws/lambda/${testRunName}`,  `Hello From ${testRunName}`, awsRegion))
			.then(events => {
				expect(events.length).toEqual(1);
			})
			.then(done, done.fail);
		});
		it('sets up the rule name, sql version and description if provided', done => {
			let functionArn;

			config.ruleName = 'test_rule_' + testRunName.replace(/-/g, '');
			config.description = 'test-rule-description';
			config.sqlVersion = 'beta';
			createLambda()
			.then(() => lambda.getFunctionConfiguration({ FunctionName: testRunName }).promise())
			.then(lambdaResult => functionArn = lambdaResult.FunctionArn)
			.then(() => underTest(config))
			.then(result => newObjects.iotTopicRule = result.ruleName)
			.then(ruleName => iot.getTopicRule({ruleName: ruleName}).promise())
			.then(topicRule => {
				expect(topicRule.rule.ruleName).toEqual('test_rule_' + testRunName.replace(/-/g, ''));
				expect(topicRule.rule.sql).toEqual('SELECT * FROM \'iot/+\'');
				expect(topicRule.rule.awsIotSqlVersion).toEqual('beta');
				expect(topicRule.rule.ruleDisabled).toEqual(false);
				expect(topicRule.rule.actions).toEqual([{lambda: { functionArn: functionArn } }]);
				expect(topicRule.rule.description).toEqual('test-rule-description');
			})
			.then(done, done.fail);

		});
		it('binds to an alias, if the version is provided', done => {
			let functionArn;
			createConfig.version = 'special';
			config.version = 'special';

			createLambda()
			.then(() => lambda.getFunctionConfiguration({ FunctionName: testRunName, Qualifier: 'special' }).promise())
			.then(lambdaResult => functionArn = lambdaResult.FunctionArn)
			.then(() => underTest(config))
			.then(result => newObjects.iotTopicRule = result.ruleName)
			.then(ruleName => iot.getTopicRule({ruleName: ruleName}).promise())
			.then(topicRule => {
				expect(topicRule.rule.sql).toEqual('SELECT * FROM \'iot/+\'');
				expect(topicRule.rule.awsIotSqlVersion).toEqual('2015-10-08');
				expect(topicRule.rule.actions).toEqual([{lambda: { functionArn: functionArn } }]);
				expect(topicRule.rule.actions[0].lambda.functionArn).toMatch(/:special$/);
			})
			.then(done, done.fail);
		});
	});
});
