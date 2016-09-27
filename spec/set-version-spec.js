/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine */
var underTest = require('../src/commands/set-version'),
	create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	retriableWrap = require('../src/util/retriable-wrap'),
	fs = require('fs'),
	path = require('path'),
	callApi = require('../src/util/call-api'),
	ArrayLogger = require('../src/util/array-logger'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('setVersion', function () {
	'use strict';
	var workingdir, testRunName, iam, lambda, newObjects,
		invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(newObjects.restApi, awsRegion, url, options);
		};
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'});
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
	});

	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	it('fails when the options do not contain a version name', function (done) {
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('version misssing. please provide using --version');
			done();
		});
	});
	it('fails when the source dir does not contain the project config file', function (done) {
		underTest({source: workingdir, version: 'dev'}).then(done.fail, function (reason) {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({source: workingdir, version: 'dev'}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest({source: workingdir, version: 'dev'}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	describe('when the lambda project does not contain a web api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', role: this.genericRole}).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('creates a new version alias of the lambda function', function (done) {
			underTest({source: workingdir, version: 'dev'}).then(function () {
				return lambda.getAliasPromise({FunctionName: testRunName, Name: 'dev'});
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('1');
			}).then(done, done.fail);
		});
		it('uses the latest numeric version', function (done) {
			shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			update({source: workingdir}).then(function () {
				return underTest({source: workingdir, version: 'dev'});
			}).then(function () {
				return lambda.getAliasPromise({FunctionName: testRunName, Name: 'dev'});
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('2');
			}).then(done, done.fail);
		});
		it('migrates an alias if it already exists', function (done) {
			shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			lambda.createAliasPromise({
				FunctionName: testRunName,
				FunctionVersion: '1',
				Name: 'dev'
			}).then(function () {
				return update({source: workingdir});
			}).then(function () {
				return underTest({source: workingdir, version: 'dev'});
			}).then(function () {
				return lambda.getAliasPromise({FunctionName: testRunName, Name: 'dev'});
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('2');
			}).then(done, done.fail);
		});
	});
	describe('when the lambda project contains a web api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/api-gw-echo/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, 'api-module': 'main', role: this.genericRole}).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
			}).then(done, done.fail);
		});
		it('creates a new api deployment', function (done) {
			underTest({source: workingdir, version: 'dev'})
			.then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/dev');
			}).then(function () {
				return invoke('dev/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'dev'
				});
			}).then(done, done.fail);
		});
		it('keeps the old stage variables if they exist', function (done) {
			var apiGateway = retriableWrap(Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), function () {}, /Async$/);
			apiGateway.createDeploymentAsync({
				restApiId: newObjects.restApi,
				stageName: 'fromtest',
				variables: {
					authKey: 'abs123',
					authBucket: 'bucket123',
					lambdaVersion: 'fromtest'
				}
			}).then(function () {
				return underTest({source: workingdir, version: 'fromtest'});
			}).then(function () {
				return invoke('fromtest/echo');
			}).then(function (contents) {
				var params;
				params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'fromtest',
					authKey: 'abs123',
					authBucket: 'bucket123'
				});
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
	});
	describe('when the lambda project contains a proxy api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', 'deploy-proxy-api': true, role: this.genericRole}).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
			}).then(done, done.fail);
		});
		it('creates a new api deployment', function (done) {
			underTest({source: workingdir, version: 'dev'})
			.then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/dev');
			}).then(function () {
				return invoke('dev/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/{proxy+}');
				expect(params.path).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'dev'
				});
			}).then(done, done.fail);
		});
		it('keeps the old stage variables if they exist', function (done) {
			var apiGateway = retriableWrap(Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), function () {}, /Async$/);
			apiGateway.createDeploymentAsync({
				restApiId: newObjects.restApi,
				stageName: 'fromtest',
				variables: {
					authKey: 'abs123',
					authBucket: 'bucket123',
					lambdaVersion: 'fromtest'
				}
			}).then(function () {
				return underTest({source: workingdir, version: 'fromtest'});
			}).then(function () {
				return invoke('fromtest/echo');
			}).then(function (contents) {
				var params;
				params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/{proxy+}');
				expect(params.path).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'fromtest',
					authKey: 'abs123',
					authBucket: 'bucket123'
				});
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
	});

	it('logs progress', function (done) {
		var logger = new ArrayLogger();
		shell.cp('-r', 'spec/test-projects/api-gw-echo/*', workingdir);
		create({name: testRunName, region: awsRegion, source: workingdir, 'api-module': 'main', role: this.genericRole}).then(function (result) {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
			newObjects.restApi = result.api && result.api.id;
		}).then(function () {
			return underTest({source: workingdir, version: 'dev'}, logger);
		}).then(function () {
			expect(logger.getStageLog(true).filter(function (entry) {
				return entry !== 'rate-limited by AWS, waiting before retry';
			})).toEqual([
				'loading config', 'updating versions'
			]);
			expect(logger.getApiCallLogForService('lambda', true)).toEqual(['lambda.publishVersion', 'lambda.updateAlias', 'lambda.createAlias']);
			expect(logger.getApiCallLogForService('sts', true)).toEqual(['sts.getCallerIdentity']);
			expect(logger.getApiCallLogForService('apigateway', true)).toEqual(['apigateway.createDeployment']);
		}).then(done, done.fail);

	});
});
