/*global describe, it, expect, beforeEach, afterEach, beforeAll, afterAll */
const underTest = require('../src/commands/add-kinesis-event-source'),
	create = require('../src/commands/create'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	fsUtil = require('../src/util/fs-util'),
	retry = require('oh-no-i-insist'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region');
describe('addKinesisEventSource', () => {
	'use strict';
	const streamName = 'test' + Date.now();

	let workingdir, testRunName, newObjects, config, logs, lambda, kinesis, streamDescription;
	beforeAll((done) => {
		console.log('creating the kinesis stream');
		kinesis = new aws.Kinesis({region: awsRegion});
		kinesis.createStream({
			StreamName: streamName,
			ShardCount: 1
		}).promise()
		.then(() => {
			return retry(() => {
				console.log('waiting for the stream to activate');
				return kinesis.describeStream({
					StreamName: streamName
				}).promise()
				.then(result => {
					if (result.StreamDescription.StreamStatus === 'ACTIVE') {
						return result.StreamDescription;
					}
					throw 'inactive';
				});
			}, 5000, 5, undefined, undefined, Promise);
		})
		.then(streamDesc => streamDescription = streamDesc)
		.then(() => console.log('created the kinesis stream'))
		.then(done, done.fail);
	});
	afterAll((done) => {
		console.log('deleting the kinesis stream');
		done();
		kinesis.deleteStream({
			StreamName: streamName
		}).promise()
		.then(() => console.log('deleted the kinesis stream'))
		.then(done, done.fail);
	});
	beforeEach(() => {
		workingdir = tmppath();
		logs = new aws.CloudWatchLogs({ region: awsRegion });
		lambda = new aws.Lambda({ region: awsRegion });
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		fs.mkdirSync(workingdir);
		config = {
			stream: streamName,
			source: workingdir,
			'starting-position': 'TRIM_HORIZON',
			'batch-size': 1
		};
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the stream is not defined in options', done => {
		config.stream = '';
		underTest(config)
		.then(done.fail, reason => {
			expect(reason).toEqual('Kinesis stream not specified. please provide it with --stream');
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
			},
			publishToStream = function (info) {
				return kinesis.putRecord({
					Data: info || 'abcd',
					PartitionKey: 'key1',
					StreamName: streamName
				}).promise();
			};
		beforeEach(() => {
			createConfig = { name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' };
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		});
		it('sets up privileges if role is given with name', done => {
			createLambda()
			.then(() => underTest(config))
			.then(() => lambda.listEventSourceMappings({FunctionName: testRunName}).promise())
			.then(config => {
				expect(config.EventSourceMappings.length).toBe(1);
				expect(config.EventSourceMappings[0].FunctionArn).toMatch(new RegExp(testRunName + '$'));
				expect(config.EventSourceMappings[0].EventSourceArn).toEqual(streamDescription.StreamARN);
			})
			.then(done, done.fail);
		});
		it('sets up stream using an ARN', done => {
			config.stream = streamDescription.StreamARN;
			createLambda()
			.then(() => underTest(config))
			.then(() => lambda.listEventSourceMappings({FunctionName: testRunName}).promise())
			.then(config => {
				expect(config.EventSourceMappings[0].EventSourceArn).toEqual(streamDescription.StreamARN);
			})
			.then(done, done.fail);
		});
		it('invokes lambda from Kinesis when no version is given', done => {
			createLambda()
			.then(() => underTest(config))
			.then(() => publishToStream(testRunName))
			.then(() => {
				return retry(() => {
					console.log(`trying to get events from /aws/lambda/${testRunName}`);
					return logs.filterLogEvents({ logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'kinesis' })
						.promise()
						.then(logEvents => {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 30000, 10, undefined, undefined, Promise);
			})
			.then(done, done.fail);
		});
		it('binds to an alias, if the version is provided', done => {
			createConfig.version = 'special';
			config.version = 'special';

			createLambda()
			.then(() => underTest(config))
			.then(() => lambda.listEventSourceMappings({FunctionName: `${testRunName}:special`}).promise())
			.then(config => {
				expect(config.EventSourceMappings.length).toBe(1);
				expect(config.EventSourceMappings[0].FunctionArn).toMatch(new RegExp(testRunName + ':special$'));
				expect(config.EventSourceMappings[0].EventSourceArn).toEqual(streamDescription.StreamARN);
			})
			.then(done, done.fail);
		});
		it('sets up batch size', done => {
			config['batch-size'] = 50;
			createLambda()
			.then(() => underTest(config))
			.then(() => lambda.listEventSourceMappings({FunctionName: testRunName}).promise())
			.then(config => {
				expect(config.EventSourceMappings.length).toBe(1);
				expect(config.EventSourceMappings[0].BatchSize).toEqual(50);
			})
			.then(done, done.fail);
		});

		it('invokes lambda from Kinesis when version is provided', done => {
			createConfig.version = 'special';
			config.version = 'special';
			createLambda()
			.then(() => underTest(config))
			.then(() => publishToStream(testRunName))
			.then(() => {
				return retry(() => {
					console.log(`trying to get events from /aws/lambda/${testRunName}`);
					return logs.filterLogEvents({ logGroupName: '/aws/lambda/' + testRunName, filterPattern: 'kinesis' })
						.promise()
						.then(logEvents => {
							if (logEvents.events.length) {
								return logEvents.events;
							} else {
								return Promise.reject();
							}
						});
				}, 30000, 10, undefined, undefined, Promise);
			})
			.then(done, done.fail);
		});
	});
});
