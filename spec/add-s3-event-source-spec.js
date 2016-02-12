/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine */
var underTest = require('../src/commands/add-s3-event-source'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('addS3EventSource', function () {
	'use strict';
	var workingdir, testRunName, newObjects, s3;
	beforeEach(function () {
		workingdir = tmppath();
		s3 = Promise.promisifyAll(new aws.S3());
		testRunName = 'test' + Date.now();
		newObjects = {workingdir: workingdir};
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
		shell.mkdir(workingdir);
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	it('fails when the bucket is not defined in options', function (done) {
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('bucket name not specified. please provide it with --bucket');
			done();
		});
	});
	it('fails when the source dir does not contain the project config file', function (done) {
		underTest({bucket: 'b', source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({bucket: 'b', source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest({bucket: 'b', source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda role', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx', region: 'abc'}}), 'utf8');
		underTest({bucket: 'b', source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.role missing from claudia.json');
			done();
		});
	});


	describe('when params are valid', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/s3-remover/*', workingdir);
			s3.createBucketAsync({
				Bucket: testRunName + '-bucket',
				ACL: 'private'
			}).then(function () {
				newObjects.s3Bucket = testRunName + '-bucket';
			}).then(done);
		});
		it('sets up privileges and s3 notifications for any created files in the s3 bucket', function (done) {
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(function () {
				return underTest({source: workingdir, bucket: testRunName + '-bucket'});
			}).then(function () {
				// needs better...
				console.log('waiting for IAM propagation');
				return Promise.delay(5000);
			}).then(function () {
				return s3.putObjectAsync({
					Bucket: testRunName + '-bucket',
					Key: testRunName  + '.txt',
					Body: 'file contents',
					ACL: 'private'
				});
			}).then(function () {
				return s3.waitForAsync('objectNotExists', {
					Bucket: testRunName + '-bucket',
					Key: testRunName  + '.txt'
				});
			}).then(done, done.fail);
		});
		it('adds a prefix if requested', function (done) {
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(function () {
				return underTest({source: workingdir, bucket: testRunName + '-bucket', prefix: '/in/'});
			}).then(function () {
				return s3.getBucketNotificationConfigurationAsync({
					Bucket: testRunName + '-bucket'
				});
			}).then(function (config) {
				expect(config.LambdaFunctionConfigurations[0].Filter.Key.FilterRules[0]).toEqual({
					Name: 'Prefix',
					Value: '/in/'
				});
			}).then(done, done.fail);
		});
		it('binds to an alias, if the version is provided', function (done) {
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', version: 'special'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(function () {
				return underTest({source: workingdir, bucket: testRunName + '-bucket', version: 'special'});
			}).then(function () {
				return s3.getBucketNotificationConfigurationAsync({
					Bucket: testRunName + '-bucket'
				});
			}).then(function (config) {
				expect(/:special$/.test(config.LambdaFunctionConfigurations[0].LambdaFunctionArn)).toBeTruthy();
			}).then(done, done.fail);
		});
		it('can execute aliased functions', function (done) {
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', version: 'special'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(function () {
				return underTest({source: workingdir, bucket: testRunName + '-bucket', version: 'special'});
			}).then(function () {
				// needs better...
				console.log('waiting for IAM propagation');
				return Promise.delay(5000);
			}).then(function () {
				return s3.putObjectAsync({
					Bucket: testRunName + '-bucket',
					Key: testRunName  + '.txt',
					Body: 'file contents',
					ACL: 'private'
				});
			}).then(function () {
				return s3.waitForAsync('objectNotExists', {
					Bucket: testRunName + '-bucket',
					Key: testRunName  + '.txt'
				});
			}).then(done, done.fail);
		});

	});

});
