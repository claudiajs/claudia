/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine */
var underTest = require('../src/commands/update'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('update', function () {
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
		shell.mkdir(workingdir);
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
	it('fails when the source dir does not contain the project config file', function (done) {
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	it('updates the lambda with a new version', function (done) {
		var invokeLambda = Promise.promisify(lambda.invoke.bind(lambda));

		shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
			newObjects = { lambdaRole: result.lambda && result.lambda.role, lambdaFunction: result.lambda && result.lambda.name };
			shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			return underTest({source: workingdir});
		}).then(function (lambdaFunc) {
			expect(new RegExp('^arn:aws:lambda:us-east-1:[0-9]+:function:' + testRunName + ':1$').test(lambdaFunc.FunctionArn)).toBeTruthy();
			expect(lambdaFunc.FunctionName).toEqual(testRunName);
			return invokeLambda({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})});
		}).then(function (lambdaResult) {
			expect(lambdaResult.StatusCode).toEqual(200);
			expect(lambdaResult.Payload).toEqual('{"message":"aloha"}');
		}).then(done, done.fail);
	});
});
