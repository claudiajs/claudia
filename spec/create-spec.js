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
	var workingdir, cwd, testRunName, iam, lambda, newObjects, originalTimeout, config;
	beforeEach(function () {
		workingdir = tmppath();
		cwd = shell.pwd();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = new aws.Lambda({region: awsRegion});
		newObjects = false;
		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
		config = {name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'};
	});
	afterEach(function (done) {
		var deleteRole = Promise.promisify(iam.deleteRole.bind(iam)),
			deleteFunction = Promise.promisify(lambda.deleteFunction.bind(lambda));
		shell.cd(cwd);
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
		if (shell.test('-e', workingdir)) {
			shell.rm('-rf', workingdir);
		}
		if (!newObjects || !newObjects.lambdaFunction) {
			return done();
		}
		deleteFunction({FunctionName: newObjects.lambdaFunction}).then(function () {
			if (!newObjects || !newObjects.lambdaRole) {
				return Promise.resolve();
			}
			return deleteRole({RoleName: newObjects.lambdaRole});
		}).catch(function (err) {
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
		var creationResult;
		beforeEach(function (done) {
			shell.mkdir(workingdir);
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			underTest(config).then(function (result) {
				creationResult = result;
				newObjects = { lambdaRole: result.lambda && result.lambda.role, lambdaFunction: result.lambda && result.lambda.name };
			}).then(done, done.fail);
		});
		it('returns an object containing the new claudia configuration', function () {
			expect(creationResult.lambda).toEqual({
				role: testRunName + '-executor',
				region: awsRegion,
				name: testRunName
			});
		});
		it('saves the configuration into claudia.json', function () {
			expect(JSON.parse(fs.readFileSync(path.join(workingdir, 'claudia.json'), 'utf8'))).toEqual(creationResult);
		});
		it('creates the IAM role for the lambda', function (done) {
			var getRole = Promise.promisify(iam.getRole.bind(iam));
			getRole({RoleName: testRunName + '-executor'}).then(function (role) {
				expect(role.Role.RoleName).toEqual(testRunName + '-executor');
			}).then(done, done.fail);
		});
		it('configures the function in AWS', function (done) {
			var invokeLambda = Promise.promisify(lambda.invoke.bind(lambda));
			invokeLambda({FunctionName: testRunName}).then(
				function (lambdaResult) {
					expect(lambdaResult.StatusCode).toEqual(200);
					expect(lambdaResult.Payload).toEqual('"hello world"');
				}).then(done, done.fail);
		});
	});
});
