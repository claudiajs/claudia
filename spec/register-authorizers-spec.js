/*global describe, it, beforeEach, afterEach, expect, require, jasmine, console */
var underTest = require('../src/tasks/register-authorizers'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	Promise = require('bluebird'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	retriableWrap = require('../src/util/retriable-wrap'),
	ConsoleLogger = require('../src/util/console-logger'),
	awsRegion = 'us-east-1';

describe('registerAuthorizers', function () {
	'use strict';
	var authorizerLambdaName, workingdir, testRunName, newObjects, apiId,
		authorizerArn,
		apiGateway = retriableWrap(Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), function () {}, /Async$/),
		lambda = new aws.Lambda({region: awsRegion}),
		checkAuthUri = function (uri) {
			expect(uri).toMatch(/^arn:aws:apigateway:us-east-1:lambda:path\/2015-03-31\/functions\/arn:aws:lambda:us-east-1:[0-9]+:function:test[0-9]+auth\/invocations$/);
			expect(uri.split(':')[11]).toEqual(testRunName + 'auth/invocations');
		};

	beforeEach(function () {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;
	});

	beforeEach(function (done) {
		var authorizerLambdaDir, genericRole;
		workingdir = tmppath();
		testRunName = 'test' + Date.now();

		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
		genericRole = this.genericRole;
		shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
		create({name: testRunName, version: 'original', role: genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(function () {
			return apiGateway.createRestApiAsync({name: testRunName});
		}).then(function (result) {
			apiId = result.id;
			newObjects.restApi = result.id;
		}).then(function () {
			authorizerLambdaDir = path.join(workingdir, 'authorizer');
			shell.mkdir(authorizerLambdaDir);
			shell.cp('-r', 'spec/test-projects/echo/*', authorizerLambdaDir);
			return create({name: testRunName + 'auth', version: 'original', role: genericRole, region: awsRegion, source: authorizerLambdaDir, handler: 'main.handler'});
		}).then(function (result) {
			authorizerLambdaName = result.lambda && result.lambda.name;
			return lambda.getFunctionConfiguration({FunctionName: authorizerLambdaName}).promise();
		}).then(function (lambdaConfig) {
			authorizerArn = lambdaConfig.FunctionArn;
		}).then(done, function (e) {
			console.log('error setting up', e);
			done.fail();
		});
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).then(function () {
			if (authorizerLambdaName) {
				return lambda.deleteFunction({FunctionName: authorizerLambdaName}).promise();
			}
		}).catch(function (err) {
			console.log('error cleaning up', err);
		}).then(done, done);
	});
	it('does nothing when authorizers are not defined', function (done) {
		underTest(false, apiId, awsRegion, new ConsoleLogger())
			.then(function (createResult) {
				expect(createResult).toEqual({});
			}).then(function () {
				return apiGateway.getAuthorizersAsync({
					restApiId: apiId
				});
			}).then(function (authorizers) {
				expect(authorizers.items).toEqual([]);
			}).then(done, done.fail);
	});
	it('creates header-based authorizers', function (done) {
		var authorizerConfig = {
				first: { lambdaName: authorizerLambdaName, headerName: 'Authorization' }
			}, result;
		underTest(authorizerConfig, apiId, awsRegion)
			.then(function (createResult) {
				result = createResult;
			}).then(function () {
				return apiGateway.getAuthorizersAsync({
					restApiId: apiId
				});
			}).then(function (authorizers) {
				expect(authorizers.items.length).toEqual(1);
				expect(result.first).toEqual(authorizers.items[0].id);
				expect(authorizers.items[0].name).toEqual('first');
				expect(authorizers.items[0].type).toEqual('TOKEN');
				expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
				checkAuthUri(authorizers.items[0].authorizerUri);
			}).then(done, done.fail);
	});
	it('uses the Authorization header by default', function (done) {
		var authorizerConfig = {
				first: { lambdaName: authorizerLambdaName }
			}, result;
		underTest(authorizerConfig, apiId, awsRegion)
			.then(function (createResult) {
				result = createResult;
			}).then(function () {
				return apiGateway.getAuthorizersAsync({
					restApiId: apiId
				});
			}).then(function (authorizers) {
				expect(authorizers.items.length).toEqual(1);
				expect(result.first).toEqual(authorizers.items[0].id);
				expect(authorizers.items[0].name).toEqual('first');
				expect(authorizers.items[0].type).toEqual('TOKEN');
				expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
				checkAuthUri(authorizers.items[0].authorizerUri);
			}).then(done, done.fail);
	});

	it('creates multiple authorizers', function (done) {
		var authorizerConfig = {
				first: { lambdaName: authorizerLambdaName, headerName: 'Authorization' },
				second: { lambdaName: authorizerLambdaName, headerName: 'UserId' }
			},
			result;
		underTest(authorizerConfig, apiId, awsRegion)
			.then(function (creationResult) {
				result = creationResult;
			}).then(function () {
				return apiGateway.getAuthorizersAsync({
					restApiId: apiId
				});
			}).then(function (authorizers) {
				var auths = {};
				expect(authorizers.items.length).toEqual(2);
				auths[authorizers.items[0].name] = authorizers.items[0];
				auths[authorizers.items[1].name] = authorizers.items[1];

				expect(result.first).toEqual(auths.first.id);
				expect(auths.first.type).toEqual('TOKEN');
				expect(auths.first.identitySource).toEqual('method.request.header.Authorization');
				checkAuthUri(auths.first.authorizerUri);

				expect(result.second).toEqual(auths.second.id);
				expect(auths.second.type).toEqual('TOKEN');
				expect(auths.second.identitySource).toEqual('method.request.header.UserId');
				checkAuthUri(auths.second.authorizerUri);
			}).then(done, done.fail);
	});
	it('overrides existing authorizers', function (done) {
		var result,
			authorizerConfig = {
				first: { lambdaName: authorizerLambdaName, headerName: 'NewFirst' },
				third: { lambdaName: authorizerLambdaName, headerName: 'NewThird' }
			};
		apiGateway.createAuthorizerAsync({
			identitySource: 'method.request.header.OldFirst',
			name: 'first',
			restApiId: apiId,
			type: 'TOKEN',
			authorizerUri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + authorizerArn + '/invocations'
		}).then(function () {
			return apiGateway.createAuthorizerAsync({
				identitySource: 'method.request.header.OldSecond',
				name: 'second',
				restApiId: apiId,
				type: 'TOKEN',
				authorizerUri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + authorizerArn + '/invocations'
			});
		}).then(function () {
			return underTest(authorizerConfig, apiId, awsRegion);
		}).then(function (creationResult) {
			result = creationResult;
		}).then(function () {
			return apiGateway.getAuthorizersAsync({
				restApiId: apiId
			});
		}).then(function (authorizers) {
			var auths = {};
			expect(authorizers.items.length).toEqual(2);
			auths[authorizers.items[0].name] = authorizers.items[0];
			auths[authorizers.items[1].name] = authorizers.items[1];

			expect(auths.first.type).toEqual('TOKEN');
			expect(result.first).toEqual(auths.first.id);
			expect(auths.first.identitySource).toEqual('method.request.header.NewFirst');
			checkAuthUri(auths.first.authorizerUri);

			expect(auths.third.type).toEqual('TOKEN');
			expect(result.third).toEqual(auths.third.id);
			expect(auths.third.identitySource).toEqual('method.request.header.NewThird');
			checkAuthUri(auths.third.authorizerUri);
		}).then(done, done.fail);
	});
	it('creates authorizers using an ARN', function (done) {
		var authorizerConfig = {
			first: { lambdaArn: authorizerArn }
		}, result;
		underTest(authorizerConfig, apiId, awsRegion)
			.then(function (createResult) {
				result = createResult;
			}).then(function () {
				return apiGateway.getAuthorizersAsync({
					restApiId: apiId
				});
			}).then(function (authorizers) {
				expect(authorizers.items.length).toEqual(1);
				expect(result.first).toEqual(authorizers.items[0].id);
				expect(authorizers.items[0].name).toEqual('first');
				expect(authorizers.items[0].type).toEqual('TOKEN');
				expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
				checkAuthUri(authorizers.items[0].authorizerUri);
			}).then(done, done.fail);

	});
	it('creates authorizers qualified by stage', function (done) {
		done.fail('not implemented yet');
	});
	it('creates authorizers qualified by a specific value', function (done) {
		done.fail('not implemented yet');
	});
});
