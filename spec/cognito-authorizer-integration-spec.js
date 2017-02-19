/*global beforeAll, afterAll, beforeEach, afterEach, describe, expect, require, console, it*/
const create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	shell = require('shelljs'),
	path = require('path'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	fs = require('../src/util/fs-promise'),
	awsRegion = require('./util/test-aws-region'),
	cognitoUserPool = require('./util/cognito-user-pool');

describe('cognitoAuthorizers', () => {
	'use strict';
	let workingdir, testRunName, apiId, newObjects;
	beforeAll(done => {
		cognitoUserPool.create().then(done, done.fail);
	});
	afterAll(done => {
		cognitoUserPool.destroy().then(done, done.fail);
	});
	beforeEach(done => {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir, config: 'claudia-api.json' };
		shell.mkdir(workingdir);
		shell.cp('-r', 'spec/test-projects/cognito-authorizers/*', workingdir);
		fs.readFileAsync(path.join(workingdir, 'api.js'), 'utf-8')
		.then(content => content.replace('TEST-USER-POOL-ARN', cognitoUserPool.getArn()))
		.then(content => fs.writeFileAsync(path.join(workingdir, 'api.js'), content))
		.then(done, done.fail);
	});
	afterEach(done => {
		destroyObjects(newObjects)
		.catch(err => console.log('error cleaning up', err))
		.then(done);
		done();
	});
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
				name: testRunName,
				version: 'original',
				region: awsRegion,
				config: 'claudia-api.json',
				'api-module': 'api'
			})
			.then(result => {
				apiId = result.api.id;
				newObjects.restApi = apiId;
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			});
		},
		setUpTests = function () {
			it('does not block access to methods without a cognito authorizer', done => {
				invoke('original/', {
					method: 'GET',
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK'))
				.then(done, done.fail);
			});
			it('blocks access to methods with a cognito authorizer without authentication headers', done => {
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
			it('blocks access to methods with a cognito authorizer for users with an invalid token', done => {
				invoke('original/locked', {
					method: 'GET',
					headers: { 'Authorization': 'ThisIsAnInvalidCognitoToken' },
					resolveErrors: true
				})
				.then(response => {
					expect(response.statusCode).toEqual(401);
					expect(response.headers['x-amzn-errortype']).toEqual('UnauthorizedException');
					expect(JSON.parse(response.body)).toEqual({ message: 'Unauthorized' });
				})
				.then(done, done.fail);
			});
			it('allows access to methods with a cognito authorizer for authorized users', done => {
				invoke('original/unlocked', {
					method: 'GET',
					headers: { 'Authorization': cognitoUserPool.getUserToken() },
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK for Bob-123'))
				.then(done, done.fail);
			});
		};

	describe('create wires up authorizers initially', () => {
		beforeEach(done => {
			createTestFixture()
			.then(done, done.fail);
		});
		setUpTests();
	});
	describe('update creates a new version', () => {
		beforeEach(done => {
			createTestFixture()
			.then(() => update({ config: 'claudia-api.json', version: 'new' }))
			.then(done, done.fail);
		});
		setUpTests();
	});
});
