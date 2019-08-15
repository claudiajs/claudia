/*global beforeAll, afterAll, describe, require, console*/
const create = require('../src/commands/create'),
	destroy = require('../src/commands/destroy'),
	path = require('path'),
	fs = require('fs'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	fsPromise = require('../src/util/fs-promise'),
	fsUtil = require('../src/util/fs-util'),
	awsRegion = require('./util/test-aws-region'),
	cognitoUserPool = require('./util/cognito-user-pool'),
	AWS = require('aws-sdk'),
	{ inspect }  = require('util');

describe('cognitoOauth2Scopes', () => {
	'use strict';
	let workingdir, testRunName, apiId;
	inspect.defaultOptions.depth = null;
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
			fsUtil.copy('spec/test-projects/cognito-oauth2-scopes', workingdir, true);
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
		destroy({ config: path.join(workingdir, 'claudia-api.json') })
			.then(() => cognitoUserPool.destroy())
			.then(() => fsUtil.rmDir(workingdir))
			.then(() => console.log('destroyed'))
			.catch(err => console.log('error cleaning up', err))
			.then(done);
	});

	describe('create wires up a cognito OAuth2 authorizer', () => {
		it('creates resource methods with authorization scopes', done => {
			const apiGateway = new AWS.APIGateway({ region: awsRegion });
			apiGateway.getResources({ restApiId: apiId }).promise()
			.then((resources) => {
				const { id } = resources.items.find(resource => resource.pathPart === 'locked'),
					params = {
						httpMethod: 'GET',
						resourceId: id,
						restApiId: apiId
					};
				apiGateway.getMethod(params).promise()
				.then(response => expect(response.authorizationScopes).toEqual(['email', 'openid']))
				.then(done, done.fail);
			});
		});
	});
});
