/*global describe, it, beforeEach, afterEach, expect, require, jasmine, console */
var underTest = require('../src/tasks/register-authorizers'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	Promise = require('bluebird'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	retriableWrap = require('../src/util/retriable-wrap'),
	awsRegion = 'us-east-1';

describe('registerAuthorizers', function () {
	'use strict';
	var authorizerLambdaName, workingdir, testRunName, newObjects, apiId,
		apiGateway = retriableWrap(Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), function () {}, /Async$/),
		lambda = new aws.Lambda({region: awsRegion});

	beforeEach(function (done) {
		var authorizerLambdaDir;
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);

		authorizerLambdaDir = path.join(workingdir, 'authorizer');

		shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
		shell.cp('-r', 'spec/test-projects/echo/*', authorizerLambdaDir);

		create({name: testRunName, version: 'original', role: this.genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(function () {
			return apiGateway.createRestApiAsync({name: testRunName});
		}).then(function (result) {
			apiId = result.id;
			newObjects.restApi = result.id;
		}).then(function () {
			return create({name: testRunName + 'auth', version: 'original', role: this.genericRole, region: awsRegion, source: authorizerLambdaDir, handler: 'main.handler'});
		}).then(function (result) {
			authorizerLambdaName = result.lambda && result.lambda.name;
		}).then(done, done.fail);
	});
	afterEach(function (done) {
		lambda.deleteFunction({FunctionName: authorizerLambdaName}).promise()
		.then(function () {
			return this.destroyObjects(newObjects);
		}).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	it('does nothing when authorizers are not defined', function (done) {
		underTest(false, apiId, awsRegion)
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
				expect(authorizers.items[0].authorizerUri).toEqual('arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/test/invocations');
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
				expect(auths.first.authorizerUri).toEqual('arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/test/invocations');

				expect(result.second).toEqual(auths.second.id);
				expect(auths.second.type).toEqual('TOKEN');
				expect(auths.second.identitySource).toEqual('method.request.header.UserId');
				expect(auths.second.authorizerUri).toEqual('arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/test/invocations');
			}).then(done, done.fail);
	});
	it('overrides existing authorizers', function (done) {
		var lambdaArn,
			result,
			authorizerConfig = {
				first: { lambdaName: authorizerLambdaName, headerName: 'NewFirst' },
				third: { lambdaName: authorizerLambdaName, headerName: 'NewThird' }
			};
		lambda.getFunctionConfiguration({FunctionName: authorizerLambdaName}).promise().then(function (lambdaConfig) {
			lambdaArn = lambdaConfig.FunctionArn;
		}).then(function () {
			return apiGateway.createAuthorizerAsync({
				identitySource: 'method.request.header.OldFirst',
				name: 'first',
				restApiId: apiId,
				type: 'TOKEN',
				authorizerUri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + lambdaArn + '/invocations'
			});
		}).then(function () {
			return apiGateway.createAuthorizerAsync({
				identitySource: 'method.request.header.OldSecond',
				name: 'second',
				restApiId: apiId,
				type: 'TOKEN',
				authorizerUri: 'arn:aws:apigateway:' + awsRegion + ':lambda:path/2015-03-31/functions/' + lambdaArn + '/invocations'
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
			expect(auths.first.authorizerUri).toEqual('arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/test/invocations');

			expect(auths.third.type).toEqual('TOKEN');
			expect(result.third).toEqual(auths.third.id);
			expect(auths.third.identitySource).toEqual('method.request.header.NewThird');
			expect(auths.third.authorizerUri).toEqual('arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/test/invocations');
		}).then(done, done.fail);
	});
	it('creates authorizers using an ARN', function (done) {
		done.fail('not implemented yet');
	});
	it('creates authorizers qualified by stage', function (done) {
		done.fail('not implemented yet');
	});
	it('creates authorizers qualified by a specific value', function (done) {
		done.fail('not implemented yet');
	});
});
