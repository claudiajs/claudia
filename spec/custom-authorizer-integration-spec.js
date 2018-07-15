/*global beforeAll, afterAll, describe, expect, require, console, it*/
const create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	setVersion = require('../src/commands/set-version'),
	destroy = require('../src/commands/destroy'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	fsUtil = require('../src/util/fs-util'),
	fs = require('fs'),
	fsPromise = require('../src/util/fs-promise'),
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
		waitUntilDeployed = function (version) {
			return invoke(version + '/', {
				method: 'GET',
				resolveErrors: false,
				retryTimeout: process.env.AWS_DEPLOY_TIMEOUT || 10000,
				retries: process.env.AWS_DEPLOY_RETRIES || 5
			});
		},
		createTestFixture = function () {
			workingdir = tmppath();
			testRunName = 'test' + Date.now();
			fs.mkdirSync(workingdir);
			fsUtil.copy('spec/test-projects/custom-authorizers', workingdir, true);
			return fsPromise.readFileAsync(path.join(workingdir, 'api.js'), 'utf-8')
			.then(content => content.replace('TEST-AUTH-LAMBDA-NAME', `${testRunName}Auth`))
			.then(content => fsPromise.writeFileAsync(path.join(workingdir, 'api.js'), content))
			.then(() => create({
				name: `${testRunName}Auth`,
				version: 'original',
				region: awsRegion,
				config: path.join(workingdir, 'claudia-auth.json'),
				handler: 'authorizer.auth',
				source: workingdir
			}))
			.then(() => create({
				name: testRunName,
				version: 'original',
				region: awsRegion,
				config: path.join(workingdir, 'claudia-api.json'),
				'api-module': 'api',
				source: workingdir
			}))
			.then(result => {
				apiId = result.api.id;
			});
		},
		setUpTests = function (version) {
			it('does not block access to methods without an authorizer', done => {
				invoke(version + '/', {
					method: 'GET',
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK'))
				.then(done, done.fail);
			});
			it('blocks access to methods without an authorizer without authentication headers', done => {
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
			it('respects IAM policy for unauthorized users', done => {
				invoke(version + '/locked', {
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
				invoke(version + '/unlocked', {
					method: 'GET',
					headers: {'Authorization': 'Bob-123'},
					resolveErrors: false
				})
				.then(response => expect(JSON.parse(response.body)).toEqual('OK for Bob'))
				.then(done, done.fail);
			});
		};
	beforeAll(done => {
		console.log('creating custom authorizer examples');
		createTestFixture()
			.then(() => waitUntilDeployed('original'))
			.then(() => console.log('created'))
			.then(done, done.fail);
	});
	afterAll(done => {
		console.log('destroying custom authorizer examples');
		destroy({ config: path.join(workingdir, 'claudia-auth.json')})
			.then(() => destroy({config: path.join(workingdir, 'claudia-api.json')}))
			.then(() => fsUtil.rmDir(workingdir))
			.then(() => console.log('destroyed'))
			.catch(err => console.log('error cleaning up', err))
			.then(done);
	});

	describe('create wires up authorizers intially', () => {
		setUpTests('original');
	});
	describe('update creates a new version', () => {
		beforeAll(done => {
			console.log('updating custom authorizer examples');
			setVersion({ source: workingdir, config: path.join(workingdir, 'claudia-auth.json'), version: 'new' })
				.then(() => update({ source: workingdir, config: path.join(workingdir, 'claudia-api.json'), version: 'new' }))
				.then(() => waitUntilDeployed('new'))
				.then(() => console.log('updated'))
				.then(done, err => {
					console.log('failed to update custom authorizer examples', err);
					done.fail();
				});
		});
		setUpTests('new');
	});
});
