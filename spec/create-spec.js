/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine */
var underTest = require('../src/commands/create'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),

	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('create', function () {
	'use strict';
	var workingdir, testRunName, iam, lambda, newObjects, config,logs;
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'});
		logs = new aws.CloudWatchLogs({region: awsRegion});
		newObjects = {workingdir: workingdir};
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
		config = {name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'};
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	it('fails if name is not given', function (done) {
		config.name = undefined;
		underTest(config).then(done.fail, function (message) {
			expect(message).toEqual('project name is missing. please specify with --name');
			done();
		});
	});
	it('fails if the region is not given', function (done) {
		config.region = undefined;
		underTest(config).then(done.fail, function (message) {
			expect(message).toEqual('AWS region is missing. please specify with --region');
			done();
		});
	});
	it('fails if the handler is not given', function (done) {
		config.handler = undefined;
		underTest(config).then(done.fail, function (message) {
			expect(message).toEqual('Lambda handler is missing. please specify with --handler');
			done();
		});
	});

	it('fails if claudia.json already exists in the source folder', function (done) {
		shell.mkdir(workingdir);
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest(config).then(done.fail, function (message) {
			expect(message).toEqual('claudia.json already exists in the source folder');
			done();
		});
	});
	it('checks the current folder if the source parameter is not defined', function (done) {
		shell.mkdir(workingdir);
		shell.cd(workingdir);
		fs.writeFileSync(path.join('claudia.json'), '{}', 'utf8');
		underTest(config).then(done.fail, function (message) {
			expect(message).toEqual('claudia.json already exists in the source folder');
			done();
		});
	});
	it('fails if package.json does not exist in the target folder', function (done) {
		shell.mkdir(workingdir);
		shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
		shell.rm(path.join(workingdir, 'package.json'));
		underTest(config).then(done.fail, function (message) {
			expect(message).toEqual('package.json does not exist in the source folder');
			done();
		});
	});
	describe('creating the function', function () {
		var createFromDir = function (dir) {
				shell.mkdir(workingdir);
				shell.cp('-r', 'spec/test-projects/' + (dir || 'hello-world') + '/*', workingdir);
				return underTest(config).then(function (result) {
					newObjects.lambdaRole = result.lambda && result.lambda.role;
					newObjects.lambdaFunction = result.lambda && result.lambda.name;
					return result;
				});
			};
		it('returns an object containing the new claudia configuration', function (done) {
			createFromDir('hello-world').then(function (creationResult) {
				expect(creationResult.lambda).toEqual({
					role: testRunName + '-executor',
					region: awsRegion,
					name: testRunName
				});
				return '';
			}).then(done, done.fail);
		});
		it('saves the configuration into claudia.json', function (done) {
			createFromDir('hello-world').then(function (creationResult) {
				expect(JSON.parse(fs.readFileSync(path.join(workingdir, 'claudia.json'), 'utf8'))).toEqual(creationResult);
			}).then(done, done.fail);
		});
		it('creates the IAM role for the lambda', function (done) {
			createFromDir('hello-world').then(function () {
				var getRole = Promise.promisify(iam.getRole.bind(iam));
				return getRole({RoleName: testRunName + '-executor'});
			}).then(function (role) {
				expect(role.Role.RoleName).toEqual(testRunName + '-executor');
			}).then(done, done.fail);
		});
		it('configures the function in AWS so it can be invoked', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello world"');
			}).then(done, done.fail);
		});
		it('configures the function so it will be versioned', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.listVersionsByFunctionPromise({FunctionName: testRunName});
			}).then(function (result) {
				expect(result.Versions.length).toEqual(2);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
			}).then(done, done.fail);
		});
		it('adds the version alias if supplied', function (done) {
			config.version = 'great';
			createFromDir('hello-world').then(function () {
				return lambda.getAliasPromise({FunctionName: testRunName, Name: 'great'});
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('1');
			}).then(done, done.fail);
		});
		it('allows the function to log to cloudwatch', function (done) {
			var createLogGroup = Promise.promisify(logs.createLogGroup.bind(logs)),
				createLogStream = Promise.promisify(logs.createLogStream.bind(logs)),
				getLogEvents = Promise.promisify(logs.getLogEvents.bind(logs));
			createLogGroup({logGroupName: testRunName + '-group'}).then(function () {
				newObjects.logGroup = testRunName + '-group';
				return createLogStream({logGroupName: testRunName + '-group', logStreamName: testRunName + '-stream'});
			}).then(function () {
				return createFromDir('cloudwatch-log');
			}).then(function () {
				return lambda.invokePromise({
					FunctionName: testRunName,
					Payload: JSON.stringify({
						region: awsRegion,
						stream: testRunName + '-stream',
						group: testRunName + '-group',
						message: 'hello ' + testRunName
					})
				});
			}).then(function () {
				return getLogEvents({logGroupName: testRunName + '-group', logStreamName: testRunName + '-stream'});
			}).then(function (logEvents) {
				expect(logEvents.events.length).toEqual(1);
				expect(logEvents.events[0].message).toEqual('hello ' + testRunName);
			}).then(done, done.fail);
		});
	});
});
