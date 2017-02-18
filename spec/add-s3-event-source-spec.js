/*global describe, it, expect, beforeEach, afterEach */
const underTest = require('../src/commands/add-s3-event-source'),
	destroyObjects = require('./util/destroy-objects'),
	create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region');
describe('addS3EventSource', () => {
	'use strict';
	let workingdir, testRunName, newObjects, s3;
	const promiseDelay = function (delay) {
		return new Promise(resolve =>
			setTimeout(() => resolve(), delay)
		);
	};

	beforeEach(() => {
		workingdir = tmppath();
		s3 = new aws.S3();
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		shell.mkdir(workingdir);
	});
	afterEach(done => {
		destroyObjects(newObjects)
		.then(done, done.fail);
	});
	it('fails when the bucket is not defined in options', done => {
		underTest({ source: workingdir })
		.then(done.fail, reason => {
			expect(reason).toEqual('bucket name not specified. please provide it with --bucket');
			done();
		});
	});
	it('fails when the source dir does not contain the project config file', done => {
		underTest({ bucket: 'b', source: workingdir })
		.then(done.fail, reason => {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({ bucket: 'b', source: workingdir })
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({ lambda: { name: 'xxx' } }), 'utf8');
		underTest({ bucket: 'b', source: workingdir })
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda role', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({ lambda: { name: 'xxx', region: 'abc' } }), 'utf8');
		underTest({ bucket: 'b', source: workingdir })
		.then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.role missing from claudia.json');
			done();
		});
	});

	describe('when params are valid', () => {
		const bucketSuffix = '.bucket';
		beforeEach(done => {
			shell.cp('-r', 'spec/test-projects/s3-remover/*', workingdir);
			s3.createBucket({
				Bucket: testRunName + bucketSuffix,
				ACL: 'private'
			}).promise()
			.then(() => {
				newObjects.s3Bucket = testRunName + bucketSuffix;
			})
			.then(done);
		});
		it('sets up privileges and s3 notifications for any created files in the s3 bucket', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({source: workingdir, bucket: testRunName + bucketSuffix}))
			.then(() => {
				// needs better...
				console.log('waiting for IAM propagation');
				return promiseDelay(5000);
			})
			.then(() => {
				return s3.putObject({
					Bucket: testRunName + bucketSuffix,
					Key: `${testRunName}.txt`,
					Body: 'file contents',
					ACL: 'private'
				}).promise();
			})
			.then(() => {
				return s3.waitFor('objectNotExists', {
					Bucket: testRunName + bucketSuffix,
					Key: `${testRunName}.txt`
				}).promise();
			})
			.then(done, done.fail);
		});
		it('adds a prefix if requested', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({source: workingdir, bucket: testRunName + bucketSuffix, prefix: 'in/'}))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => {
				expect(config.LambdaFunctionConfigurations[0].Filter.Key.FilterRules[0]).toEqual({
					Name: 'Prefix',
					Value: 'in/'
				});
			})
			.then(done, done.fail);
		});
		it('adds a suffix if requested', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({source: workingdir, bucket: testRunName + bucketSuffix, suffix: '.jpg'}))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => {
				expect(config.LambdaFunctionConfigurations[0].Filter.Key.FilterRules[0]).toEqual({
					Name: 'Suffix',
					Value: '.jpg'
				});
			})
			.then(done, done.fail);
		});
		it('adds both a prefix and suffix if requested', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({source: workingdir, bucket: testRunName + bucketSuffix, prefix: 'in/', suffix: '.jpg'}))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => {
				expect(config.LambdaFunctionConfigurations[0].Filter.Key.FilterRules[0]).toEqual({
					Name: 'Prefix',
					Value: 'in/'
				});
				expect(config.LambdaFunctionConfigurations[0].Filter.Key.FilterRules[1]).toEqual({
					Name: 'Suffix',
					Value: '.jpg'
				});
			})
			.then(done, done.fail);
		});
		it('adds default event if no events requested', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix }))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => expect(config.LambdaFunctionConfigurations[0].Events).toEqual(['s3:ObjectCreated:*']))
			.then(done, done.fail);
		});
		it('adds events if requested', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix, events: 's3:ObjectCreated:*,s3:ObjectRemoved:*' }))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => expect(config.LambdaFunctionConfigurations[0].Events.sort()).toEqual(['s3:ObjectCreated:*', 's3:ObjectRemoved:*']))
			.then(done, done.fail);
		});
		it('binds to an alias, if the version is provided', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', version: 'special' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix, version: 'special' }))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => expect(/:special$/.test(config.LambdaFunctionConfigurations[0].LambdaFunctionArn)).toBeTruthy())
			.then(done, done.fail);
		});
		it('can execute aliased functions', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', version: 'special' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix, version: 'special' }))
			.then(() => {
				// needs better...
				console.log('waiting for IAM propagation');
				return promiseDelay(5000);
			})
			.then(() => {
				return s3.putObject({
					Bucket: testRunName + bucketSuffix,
					Key: `${testRunName}.txt`,
					Body: 'file contents',
					ACL: 'private'
				}).promise();
			})
			.then(() => {
				return s3.waitFor('objectNotExists', {
					Bucket: testRunName + bucketSuffix,
					Key: `${testRunName}.txt`
				}).promise();
			})
			.then(done, done.fail);
		});
		it('does not change any existing notification configurations', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', version: 'special' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix, version: 'special',  prefix: '/special/' }))
			.then(() => {
				shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
				return update({ source: workingdir, version: 'crazy' });
			})
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix, version: 'crazy',  prefix: '/crazy/' }))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => {
				expect(config.LambdaFunctionConfigurations.length).toEqual(2);
				expect(config.LambdaFunctionConfigurations[0].LambdaFunctionArn).toMatch(/:special$/);
				expect(config.LambdaFunctionConfigurations[1].LambdaFunctionArn).toMatch(/:crazy$/);
			})
			.then(done, done.fail);
		});
		it('allows adding several events for the same bucket', done => {
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' })
			.then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix, events: 's3:ObjectCreated:*', prefix: '/in/' }))
			.then(() => underTest({ source: workingdir, bucket: testRunName + bucketSuffix, events: 's3:ObjectRemoved:*', prefix: '/out/'}))
			.then(() => {
				return s3.getBucketNotificationConfiguration({
					Bucket: testRunName + bucketSuffix
				}).promise();
			})
			.then(config => {
				expect(config.LambdaFunctionConfigurations[0].Filter.Key.FilterRules[0]).toEqual({
					Name: 'Prefix',
					Value: '/in/'
				});
				expect(config.LambdaFunctionConfigurations[1].Filter.Key.FilterRules[0]).toEqual({
					Name: 'Prefix',
					Value: '/out/'
				});
			})
			.then(done, done.fail);
		});

	});
});
