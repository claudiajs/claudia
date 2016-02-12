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
	var workingdir, testRunName, iam, lambda, newObjects;
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = new aws.Lambda({region: awsRegion});
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
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
	describe('when the lambda project exists', function () {
		var invokeLambda, listVersions;

		beforeEach(function (done) {
			invokeLambda = Promise.promisify(lambda.invoke.bind(lambda));
			listVersions = Promise.promisify(lambda.listVersionsByFunction.bind(lambda));
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			}).then(done, done.fail);
		});
		it('creates a new version of the lambda function', function (done) {
			underTest({source: workingdir}).then(function (lambdaFunc) {
				expect(new RegExp('^arn:aws:lambda:us-east-1:[0-9]+:function:' + testRunName + ':2$').test(lambdaFunc.FunctionArn)).toBeTruthy();
			}).then(function () {
				return listVersions({FunctionName: testRunName});
			}).then(function (result) {
				expect(result.Versions.length).toEqual(3);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
				expect(result.Versions[2].Version).toEqual('2');
			}).then(done, done.fail);
		});
		it('updates the lambda with a new version', function (done) {
			underTest({source: workingdir}).then(function () {
				return invokeLambda({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"message":"aloha"}');
			}).then(done, done.fail);
		});
		it('checks the current dir if the source is not provided', function (done) {
			underTest({source: workingdir}).then(function (lambdaFunc) {
				expect(new RegExp('^arn:aws:lambda:us-east-1:[0-9]+:function:' + testRunName + ':1$').test(lambdaFunc.FunctionArn)).toBeTruthy();
				expect(lambdaFunc.FunctionName).toEqual(testRunName);
				return invokeLambda({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})});
			}).then(done, done.fail);
		});

	});
});
