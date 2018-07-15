/*global beforeAll, afterAll, describe, expect, require, console, it*/
const create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	destroy = require('../src/commands/destroy'),
	path = require('path'),
	fs = require('fs'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	fsPromise = require('../src/util/fs-promise'),
	fsUtil = require('../src/util/fs-util'),
	awsRegion = require('./util/test-aws-region'),
	cognitoUserPool = require('./util/cognito-user-pool');

describe('cognitoAuthorizers', () => {
	'use strict';
	let workingdir, testRunName, apiId;
	const invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(apiId, awsRegion, url, options);
		},
		waitUntilDeployed = function (version) {
			return invoke(version + '/', {
				method: 'GET',
				resolveErrors: false,
				retryTimeout: process.env.AWS_DEPLOY_TIMEOUT || 10000,
				retries: process.env.AWS_DEPLOY_RETRIES || 5
			});
		},
		createTestFixture = function () {
			testRunName = 'test' + Date.now();
			workingdir = tmppath();
			fs.mkdirSync(workingdir);
			fsUtil.copy('spec/test-projects/cognito-authorizers', workingdir, true);
			return fsPromise.readFileAsync(path.join(workingdir, 'api.js'), 'utf-8')
				.then(content => content.replace('TEST-USER-POOL-ARN', cognitoUserPool.getArn()))
				.then(content => fsPromise.writeFileAsync(path.join(workingdir, 'api.js'), content))
				.then(() => create({
					name: testRunName,
					version: 'original',
					region: awsRegion,
					config: path.join(workingdir, 'claudia-api.json'),
					source: workingdir,
					'api-module': 'api'
				}))
				.then(result => {
					apiId = result.api.id;
				});
		},
		setUpTests = function (version) {
			it('does not block access to methods without a cognito authorizer', done => {
				invoke(version + '/', {
					method: 'GET',
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK'))
				.then(done, done.fail);
			});
			it('blocks access to methods with a cognito authorizer without authentication headers', done => {
				invoke(version + '/locked', {
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
				invoke(version + '/locked', {
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
				invoke(version + '/unlocked', {
					method: 'GET',
					headers: { 'Authorization': cognitoUserPool.getUserToken() },
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK for Bob-123'))
				.then(done, done.fail);
			});
		};

	beforeAll(done => {
		console.log('creating cognito authorizer examples');
		cognitoUserPool.create()
			.then(createTestFixture)
			.then(() => waitUntilDeployed('original'))
			.then(() => console.log('created'))
			.then(done, done.fail);
	});
	afterAll(done => {
		console.log('destroying cognito authorizer examples');
		destroy({config: path.join(workingdir, 'claudia-api.json')})
			.then(() => cognitoUserPool.destroy())
			.then(() => fsUtil.rmDir(workingdir))
			.then(() => console.log('destroyed'))
			.catch(err => console.log('error cleaning up', err))
			.then(done);
	});

	describe('create wires up a cognito authorizer initially', () => {
		setUpTests('original');
	});
	describe('update connects a new version to cognito authorizers', () => {
		beforeAll(done => {
			console.log('updating custom authorizer examples');
			update({ source: workingdir, config: path.join(workingdir, 'claudia-api.json'), version: 'new' })
				.then(() => waitUntilDeployed('new'))
				.then(() => console.log('updated'))
				.then(done, err => {
					console.log('failed to update authorizer examples', err);
					done.fail();
				});
		});
		setUpTests('new');
	});
});
