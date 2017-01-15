/*global beforeEach, afterEach, describe, expect, require, console, it*/
const create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	setVersion = require('../src/commands/set-version'),
	destroy = require('../src/commands/destroy'),
	shell = require('shelljs'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	fs = require('../src/util/fs-promise'),
	awsRegion = require('./util/test-aws-region');
describe('customAuthorizers', () => {
	'use strict';
	let workingdir, testRunName, apiId;
	const invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(apiId, awsRegion, url, options);
		},
		createTestFixture = function () {
			shell.cd(workingdir);
			return create({
				name: `${testRunName}Auth`,
				version: 'original',
				region: awsRegion,
				config: 'claudia-auth.json',
				handler: 'authorizer.auth'
			})
			.then(() => create({ name: testRunName, version: 'original', region: awsRegion, config: 'claudia-api.json', 'api-module': 'api' }))
			.then(result => {
				apiId = result.api.id;
			});
		},
		setUpTests = function () {
			it('does not block access to methods without an authorizer', done => {
				invoke('original/', {
					method: 'GET',
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK'))
				.then(done, done.fail);
			});
			it('blocks access to methods without an authorizer without authentication headers', done => {
				invoke('original/locked', {
					method: 'GET',
					resolveErrors: true
				})
				.then(response => {
					expect(response.statusCode).toEqual(401);
					expect(response.headers['x-amzn-errortype']).toEqual('UnauthorizedException');
					expect(JSON.parse(response.body)).toEqual({ message: 'Unauthorized' });
				})
				.then(done, done.fail);
			});
			it('respects IAM policy for unauthorized users', done => {
				invoke('original/locked', {
					method: 'GET',
					headers: {'Authorization': 'Bob-123'},
					resolveErrors: true
				})
				.then(response => {
					expect(response.statusCode).toEqual(403);
					expect(response.headers['x-amzn-errortype']).toEqual('AccessDeniedException');
					expect(JSON.parse(response.body)).toEqual({ Message: 'User is not authorized to access this resource' });
				})
				.then(done, done.fail);
			});
			it('respects IAM policy for authorized users', done => {
				invoke('original/unlocked', {
					method: 'GET',
					headers: {'Authorization': 'Bob-123'},
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK for Bob'))
				.then(done, done.fail);
			});
		};
	beforeEach(done => {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		shell.mkdir(workingdir);
		shell.cp('-r', 'spec/test-projects/custom-authorizers/*', workingdir);
		fs.readFileAsync(path.join(workingdir, 'api.js'), 'utf-8')
		.then(content => content.replace('TEST-AUTH-LAMBDA-NAME', `${testRunName}Auth`))
		.then(content => fs.writeFileAsync(path.join(workingdir, 'api.js'), content))
		.then(done, done.fail);
	});
	afterEach(done => {
		destroy({ source: workingdir, config: 'claudia-auth.json' })
		.then(() => destroy({source: workingdir, config: 'claudia-api.json'}))
		.catch(err => console.log('error cleaning up', err))
		.then(done);
	});

	describe('create wires up authorizers intially', () => {
		beforeEach(done => {
			createTestFixture()
			.then(done, done.fail);
		});
		setUpTests();
	});
	describe('update creates a new version', () => {
		beforeEach(done => {
			createTestFixture()
			.then(() => setVersion({ config: 'claudia-auth.json', version: 'new' }))
			.then(() => update({ config: 'claudia-api.json', version: 'new' }))
			.then(done, done.fail);
		});
		setUpTests();
	});
});
