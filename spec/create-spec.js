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
	var workingdir, cwd, testRunName, iam, lambda, newObjects, originalTimeout;
	beforeEach(function () {
		workingdir = tmppath();
		cwd = shell.pwd();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = new aws.Lambda({region: awsRegion});
		newObjects = false;
		originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
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
		underTest({}).then(done.fail, function (message) {
			expect(message).toEqual('project name is missing. please specify with --name');
			done();
		});
	});
	it('fails if the region is not given', function (done) {
		underTest({name: testRunName, source: workingdir}).then(done.fail, function (message) {
			expect(message).toEqual('AWS region is missing. please specify with --region');
			done();
		});
	});
	it('fails if claudia.json already exists in the source folder', function (done) {
		shell.mkdir(workingdir);
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({name: testRunName, region: awsRegion, source: workingdir}).then(done.fail, function (message) {
			expect(message).toEqual('claudia.json already exists in the source folder');
			done();
		});
	});
	it('checks the current folder if the source parameter is not defined', function (done) {
		shell.mkdir(workingdir);
		shell.cd(workingdir);
		fs.writeFileSync(path.join('claudia.json'), '{}', 'utf8');
		underTest({name: testRunName, region: awsRegion, source: workingdir}).then(done.fail, function (message) {
			expect(message).toEqual('claudia.json already exists in the source folder');
			done();
		});
	});
	it('fails if package.json does not exist in the target folder', function (done) {
		shell.mkdir(workingdir);
		shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
		shell.rm(path.join(workingdir, 'package.json'));
		underTest({name: testRunName, region: awsRegion, source: workingdir}).then(done.fail, function (message) {
			expect(message).toEqual('package.json does not exist in the source folder');
			done();
		});
	});
	it('creates the role and the lambda function, saving the results into claudia.json', function (done) {
		var getRole = Promise.promisify(iam.getRole.bind(iam)),
			getFunctionConfiguration = Promise.promisify(lambda.getFunctionConfiguration.bind(lambda)),
			invokeLambda = Promise.promisify(lambda.invoke.bind(lambda));
		shell.mkdir(workingdir);
		shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
		underTest({name: testRunName, region: awsRegion, source: workingdir}).then(function (result) {
			newObjects = { lambdaRole: result.lambda && result.lambda.role, lambdaFunction: result.lambda && result.lambda.name };
			expect(result.lambda).toEqual({
				role: testRunName + '-executor',
				region: awsRegion,
				name: testRunName
			});
			expect(JSON.parse(fs.readFileSync(path.join(workingdir, 'claudia.json'), 'utf8'))).toEqual(result);
			return getRole({RoleName: testRunName + '-executor'}).then(function (role) {
				expect(role.Role.RoleName).toEqual(testRunName + '-executor');
			}).then(function () {
				return getFunctionConfiguration({FunctionName: testRunName});
			}).then(function (lambda) {
				expect(lambda.FunctionName).toEqual(testRunName);
				return invokeLambda({FunctionName: lambda.FunctionName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello world"');
			});
		}).then(done, done.fail);
	});
});
