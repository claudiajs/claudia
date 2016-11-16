/*global describe, require, it, expect, beforeEach, afterEach, jasmine */
var underTest = require('../src/commands/test-lambda'),
	create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	awsRegion = 'us-east-1';
describe('testLambda', function () {
	'use strict';
	var workingdir, testRunName, iam, lambda, newObjects;
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = new aws.Lambda({region: awsRegion});
		newObjects = {workingdir: workingdir};
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
		shell.mkdir(workingdir);
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).then(done);
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

	it('invokes a lambda function and returns the result', function (done) {
		shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
			return underTest({source: workingdir});
		}).then(function (result) {
			expect(result.StatusCode).toEqual(200);
			expect(result.Payload).toEqual('"hello world"');
			done();
		}, done.fail);
	});
	it('tests a specific version of the lambda function and returns the result', function (done) {
		shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', version: 'original'}).then(function (result) {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(function () {
			shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			return update({source: workingdir, version: 'updated'});
		}).then(function () {
			return underTest({source: workingdir, version: 'original'});
		}).then(function (result) {
			expect(result.StatusCode).toEqual(200);
			expect(result.Payload).toEqual('"hello world"');
			done();
		}, done.fail);
	});
	it('invokes a lambda function with a payload', function (done) {
		var eventData = {
			who: 'me',
			sub: {name: 'good', val: 2}
		};
		shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(function () {
			var eventFile = path.join(workingdir, 'event.json');
			fs.writeFileSync(eventFile, JSON.stringify(eventData), 'utf8');
			return underTest({source: workingdir, event: eventFile});
		}).then(function (result) {
			expect(result.StatusCode).toEqual(200);
			expect(JSON.parse(result.Payload)).toEqual(eventData);
			done();
		}, done.fail);
	});
});
