/*global describe, require, it, expect, beforeEach, jasmine */
var underTest = require('../src/commands/destroy'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('destroy', function () {
	'use strict';
	var workingdir, testRunName, lambda, config, newObjects, apiGateway, iam;
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		lambda = Promise.promisifyAll(new aws.Lambda({ region: awsRegion }), { suffix: 'Promise' });
		apiGateway = Promise.promisifyAll(new aws.APIGateway({ region: awsRegion }));
		iam = Promise.promisifyAll(new aws.IAM());
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 40000;
		newObjects = { workingdir: workingdir };
		shell.mkdir(workingdir);
		config = { name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' };
	});
	it('fails when the source dir does not contain the project config file', function (done) {
		underTest({ source: workingdir }).then(done.fail, function (reason) {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({ source: workingdir }).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({ lambda: { name: 'xxx' } }), 'utf8');
		underTest({ source: workingdir }).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	describe('when only a lambda function exists', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			create({ name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' }).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				shell.cp('-rf', 'spec/test-projects/hello-world/*', workingdir);
			}).then(done, done.fail);
		});
		it('destroys the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return lambda.listVersionsByFunctionPromise({ FunctionName: testRunName });
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaFunction);
			}).then(done, done.fail);
		});
		it('destroys the roles for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.getRoleAsync({ RoleName: newObjects.lambdaRole });
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaRole);
			}).then(done, done.fail);
		});
		it('destroys the policies for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.listRolePoliciesAsync({ RoleName: newObjects.lambdaRole });
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaRole);
			}).then(done, done.fail);
		});
	});
	describe('when the lambda project contains a web api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/api-gw-hello-world/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, 'api-module': 'main'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
				shell.cp('-rf', 'spec/test-projects/api-gw-hello-world/*', workingdir);
			}).then(done, done.fail);
		});
		it('destroys the web api function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return apiGateway.getRestApi({ restApiId: newObjects.restApi });
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.restApi);
			}).then(done, done.fail);
		});
		it('destroys the roles for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.getRoleAsync({ RoleName: newObjects.lambdaRole });
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaRole);
			}).then(done, done.fail);
		});
		it('destroys the policies for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.listRolePoliciesAsync({ RoleName: newObjects.lambdaRole });
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaRole);
			}).then(done, done.fail);
		});
	});
});
