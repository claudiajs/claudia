/*global describe, require, it, expect, beforeEach, jasmine */
var underTest = require('../src/commands/destroy'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	retriableWrap = require('../src/util/retriable-wrap'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	awsRegion = 'us-east-1';
describe('destroy', function () {
	'use strict';
	var workingdir, testRunName, config, newObjects, iam;
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
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
				var lambda = new aws.Lambda({ region: awsRegion });
				return lambda.listVersionsByFunction({ FunctionName: testRunName }).promise();
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaFunction);
			}).then(done, done.fail);
		});
		it('destroys the roles for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.getRole({ RoleName: newObjects.lambdaRole }).promise();
			}).catch(function (expectedException) {
				expect(expectedException.code).toEqual('NoSuchEntity');
			}).then(done, done.fail);
		});
		it('destroys the policies for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.listRolePolicies({ RoleName: newObjects.lambdaRole }).promise();
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
		it('destroys the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				var lambda = new aws.Lambda({ region: awsRegion });
				return lambda.listVersionsByFunction({ FunctionName: testRunName }).promise();
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaFunction);
			}).then(done, done.fail);
		});

		it('destroys the web api', function (done) {
			underTest({ source: workingdir }).then(function () {
				var apiGateway = retriableWrap(new aws.APIGateway({ region: awsRegion }));
				return apiGateway.getRestApi({ restApiId: newObjects.restApi }).promise();
			}).catch(function (expectedException) {
				expect(expectedException.message).toEqual('Invalid REST API identifier specified');
				expect(expectedException.code).toEqual('NotFoundException');
			}).then(done, done.fail);
		});
		it('destroys the roles for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.getRole({ RoleName: newObjects.lambdaRole }).promise();
			}).catch(function (expectedException) {
				expect(expectedException.code).toEqual('NoSuchEntity');
			}).then(done, done.fail);
		});
		it('destroys the policies for the lambda function', function (done) {
			underTest({ source: workingdir }).then(function () {
				return iam.listRolePolicies({ RoleName: newObjects.lambdaRole }).promise();
			}).catch(function (expectedException) {
				expect(expectedException.message).toContain(newObjects.lambdaRole);
			}).then(done, done.fail);
		});
	});
});
