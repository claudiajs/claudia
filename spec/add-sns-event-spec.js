/*global describe, it, expect, beforeEach, afterEach */
const underTest = require('../src/commands/add-sns-event-source'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	retry = require('oh-no-i-insist'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	path = require('path'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region');
describe('addSNSEventSource', () => {
	'use strict';
	let workingdir, testRunName, newObjects, config, logs, lambda, sns;
	beforeEach(() => {
		workingdir = tmppath();
		logs = new aws.CloudWatchLogs({ region: awsRegion });
		lambda = new aws.Lambda({ region: awsRegion });
		sns = new aws.SNS({ region: awsRegion });
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		fs.mkdirSync(workingdir);
		config = {
			topic: 'test-topic',
			source: workingdir
		};
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the topic is not defined in options', done => {
		config.topic = '';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('SNS topic not specified. please provide it with --topic');
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
		beforeEach(done => {
			createConfig = { name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' };
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			sns.createTopic({
				Name: `${testRunName}-topic`
			}).promise()
			.then(result => {
				newObjects.snsTopic = result.TopicArn;
				config.topic = result.TopicArn;
			})
			.then(done);
		});
		it('sets up privileges and rule notifications if no version given', done => {
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
			.then(() => sns.listSubscriptionsByTopic({TopicArn: config.topic}).promise())
			.then(config => {
				expect(config.Subscriptions.length).toBe(1);
				expect(config.Subscriptions[0].Endpoint).toEqual(functionArn);
			})
			.then(done, done.fail);
		});
		it('invokes lambda from SNS when no version is given', done => {
			createLambda()
			.then(() => underTest(config))
			.then(() => {
				return sns.publish({
					Message: JSON.stringify({name: 'Mike'}),
					TopicArn: config.topic
				}).promise();
			})
			.then(() => {
				return retry(() => {
					console.log(`trying to get events from /aws/lambda/${testRunName}`);
					return logs.filterLogEvents({ logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'aws sns EventSubscription' })
						.promise()
						.then(logEvents => {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 5000, 5, undefined, undefined, Promise);
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
			})
			.then(() => underTest(config))
			.then(() => sns.listSubscriptionsByTopic({TopicArn: config.topic}).promise())
			.then(config => {
				expect(config.Subscriptions.length).toBe(1);
				expect(config.Subscriptions[0].Endpoint).toEqual(functionArn);
			})
			.then(done, done.fail);
		});
		it('invokes lambda from SNS when version is provided', done => {
			createConfig.version = 'special';
			config.version = 'special';
			createLambda()
			.then(() => underTest(config))
			.then(() => {
				return sns.publish({
					Message: JSON.stringify({name: 'Mike'}),
					TopicArn: config.topic
				}).promise();
			})
			.then(() => {
				return retry(() => {
					console.log('trying to get events from ' + '/aws/lambda/' + testRunName);
					return logs.filterLogEvents({logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'aws sns EventSubscription'})
						.promise()
						.then(logEvents => {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 5000, 5);
			})
			.then(done, done.fail);
		});
	});
});
