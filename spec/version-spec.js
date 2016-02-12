/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine */
var underTest = require('../src/commands/set-version'),
	create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('setVersion', function () {
	'use strict';
	var workingdir, testRunName, iam, lambda, newObjects;
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'});
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
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
	describe('when the lambda project exists', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
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
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('2');
			}).then(done, done.fail);
		});
	});
});

