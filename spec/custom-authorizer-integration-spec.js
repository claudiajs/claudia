/*global beforeEach, afterEach, describe, expect, require, console, jasmine, it*/
var create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	setVersion = require('../src/commands/set-version'),
	destroy = require('../src/commands/destroy'),
	shell = require('shelljs'),
	Promise = require('bluebird'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	fs = Promise.promisifyAll(require('fs')),
	awsRegion = 'us-east-1';
describe('customAuthorizers', function () {
	'use strict';
	var workingdir, testRunName, newObjects, apiId,
		invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(apiId, awsRegion, url, options);
		},
		createTestFixture = function () {
			shell.cd(workingdir);
			return create({name: testRunName + 'Auth', version: 'original',
				region: awsRegion, config: 'claudia-auth.json', handler: 'authorizer.auth'})
			.then(function () {
				return create({name: testRunName, version: 'original', region: awsRegion, config: 'claudia-api.json', 'api-module': 'api'});
			}).then(function (result) {
				apiId = result.api.id;
			});
		},
		setUpTests = function () {
			it('does not block access to methods without an authorizer', function (done) {
				invoke('original/', {
					method: 'GET',
					resolveErrors: false
				}).then(function (response) {
					expect(JSON.parse(response.body)).toEqual('OK');
				}).then(done, done.fail);
			});
			it('blocks access to methods without an authorizer without authentication headers', function (done) {
				invoke('original/locked', {
					method: 'GET',
					resolveErrors: true
				}).then(function (response) {
					expect(response.statusCode).toEqual(401);
					expect(response.headers['x-amzn-errortype']).toEqual('UnauthorizedException');
					expect(JSON.parse(response.body)).toEqual({ message: 'Unauthorized' });
				}).then(done, done.fail);
			});
			it('respects IAM policy for unauthorized users', function (done) {
				invoke('original/locked', {
					method: 'GET',
					headers: {'Authorization': 'Bob-123'},
					resolveErrors: true
				}).then(function (response) {
					expect(response.statusCode).toEqual(403);
					expect(response.headers['x-amzn-errortype']).toEqual('AccessDeniedException');
					expect(JSON.parse(response.body)).toEqual({ Message: 'User is not authorized to access this resource' });
				}).then(done, done.fail);
			});
			it('respects IAM policy for authorized users', function (done) {
				invoke('original/unlocked', {
					method: 'GET',
					headers: {'Authorization': 'Bob-123'},
					resolveErrors: false
				}).then(function (response) {
					expect(JSON.parse(response.body)).toEqual('OK for Bob');
				}).then(done, done.fail);
			});
		};
	beforeEach(function (done) {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
		shell.cp('-r', 'spec/test-projects/custom-authorizers/*', workingdir);
		fs.readFileAsync(path.join(workingdir, 'api.js'), 'utf-8').then(function (content) {
			content = content.replace('TEST-AUTH-LAMBDA-NAME', testRunName + 'Auth');
			return fs.writeFileAsync(path.join(workingdir, 'api.js'), content);
		}).then(done, done.fail);
	});
	afterEach(function (done) {
		destroy({source: workingdir, config: 'claudia-auth.json'}).then(function () {
			return destroy({source: workingdir, config: 'claudia-api.json'});
		}).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});

	describe('create wires up authorizers intially', function () {
		beforeEach(function (done) {
			createTestFixture().then(done, done.fail);
		});
		setUpTests();
	});
	describe('update creates a new version', function () {
		beforeEach(function (done) {
			createTestFixture().then(function () {
				return setVersion({config: 'claudia-auth.json', version: 'new'});
			}).then(function () {
				return update({config: 'claudia-api.json', version: 'new'});
			}).then(done, done.fail);
		});
		setUpTests();
	});
});
