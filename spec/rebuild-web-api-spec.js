/*global beforeEach, afterEach, describe, expect, require, console, jasmine, it*/
var underTest = require('../src/tasks/rebuild-web-api'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	querystring = require('querystring'),
	got = require('got'),
	tmppath = require('../src/util/tmppath'),
	retry = require('../src/util/retry'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	awsRegion = 'us-east-1';
describe('rebuildWebApi', function () {
	'use strict';
	var workingdir, testRunName, newObjects, apiId,
		apiGateway = Promise.promisifyAll(new aws.APIGateway({region: awsRegion})),
		apiUrl = function (path) {
			return 'https://' +	apiId + '.execute-api.us-east-1.amazonaws.com/' + path;
		};
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 40000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});

	describe('when working with a blank api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
			create({name: testRunName, version: 'original', region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(function () {
				return apiGateway.createRestApiAsync({
					name: testRunName
				});
			}).then(function (result) {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);

		});
		it('creates and links an API to a lambda version', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET']}}, awsRegion)
			.then(function () {
				return retry(function () {
						var url = apiUrl('original/echo');
						return got.get(url);
					}, 3000, 5, function (err) {
						return err.statusCode === 403;
					});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(done, done.fail);
		});
		describe('request parameter processing', function () {
			it('captures query string parameters', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET']}}, awsRegion)
				.then(function () {
					return retry(function () {
							var url = apiUrl('original/echo?name=mike&' + encodeURIComponent('to=m') + '=' + encodeURIComponent('val,a=b'));
							return got.get(url);
						}, 3000, 5, function (err) {
							return err.statusCode === 403;
						});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.queryString).toEqual({name: 'mike', 'to=m': 'val,a=b'});
				}).then(done, done.fail);
			});
			it('captures headers', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET']}}, awsRegion)
				.then(function () {
					return retry(
						function () {
							return got.get(apiUrl('original/echo'), {
								headers: {'auth-head': 'auth-val'}
							});
						}, 3000, 5, function (err) {
							return err.statusCode === 403;
						});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.headers['auth-head']).toEqual('auth-val');
				}).then(done, done.fail);
			});
			it('captures stage variables', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET']}}, awsRegion)
				.then(function () {
					return apiGateway.createDeploymentAsync({
						restApiId: apiId,
						stageName: 'fromtest',
						variables: {
							lambdaVersion: 'original',
							authKey: 'abs123',
							authBucket: 'bucket123'
						}
					});
				})
				.then(function () {
					return retry(
						function () {
							return got.get(apiUrl('fromtest/echo'));
						}, 3000, 5, function (err) {
							return err.statusCode === 403;
						});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.env).toEqual({
						lambdaVersion: 'original',
						authKey: 'abs123',
						authBucket: 'bucket123'
					});
				}).then(done, done.fail);
			});
			it('captures form post variables', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['POST']}}, awsRegion)
				.then(function () {
					return retry(
						function () {
							return got.post(apiUrl('original/echo'), {
								headers: {'content-type': 'application/x-www-form-urlencoded'},
								body: querystring.stringify({name: 'tom', surname: 'bond'})
							});
						}, 3000, 5, function (err) {
							console.log(err);
							return err.statusCode === 403;
						});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.post).toEqual({name: 'tom', surname: 'bond'});
				}).then(done, done.fail);
			});
		});
		it('creates multiple methods for the same resource', function (done) {
			var url = apiUrl('original/echo');

			underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET', 'POST', 'PUT']}}, awsRegion)
			.then(function () {
				return retry(function () {
					return got.get(url);
				}, 3000, 5, function (err) {
					return err.statusCode === 403;
				});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return retry(function () {
					return got.post(url);
				}, 3000, 5, function (err) {
					return err.statusCode === 403;
				});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return retry(function () {
					return got.put(url);
				}, 3000, 5, function (err) {
					return err.statusCode === 403;
				});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('PUT');
				expect(params.context.path).toEqual('/echo');
			}).then(done, done.fail);

		});
		it('creates multiple resources for the same resource', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET']}, 'hello': { methods: ['POST']}}, awsRegion)
			.then(function () {
				return retry(function () {
					return got.get(apiUrl('original/echo'));
				}, 3000, 5, function (err) {
					return err.statusCode === 403;
				});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return retry(function () {
					return got.post(apiUrl('original/hello'));
				}, 3000, 5, function (err) {
					return err.statusCode === 403;
				});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/hello');
			}).then(done, done.fail);
		});
		it('creates OPTIONS handlers for CORS', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET']}, 'hello': { methods: ['POST', 'GET']}}, awsRegion)
			.then(function () {
				return retry(function () {
					return got(apiUrl('original/echo'), {method: 'OPTIONS'});
				}, 3000, 5, function (err) {
					return err.statusCode === 403;
				});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-methods']).toEqual('GET,OPTIONS');
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(function () {
				return retry(function () {
					return got(apiUrl('original/hello'), {method: 'OPTIONS'});
				}, 3000, 5, function (err) {
					return err.statusCode === 403;
				});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-methods']).toEqual('POST,GET,OPTIONS');
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(done, done.fail);
		});

	});

	describe('when working with an existing  api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
			create({name: testRunName, version: 'original', region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(function () {
				return apiGateway.createRestApiAsync({
					name: testRunName
				});
			}).then(function (result) {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(function () {
				return underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET']}, 'hello': { methods: ['POST']}}, awsRegion);
			}).then(done, done.fail);
		});
		it('adds extra paths from the new definition', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {'extra': { methods: ['GET']}}, awsRegion)
			.then(function () {
				return retry(function () {
						var url = apiUrl('original/extra');
						return got.get(url);
					}, 3000, 5, function (err) {
						return err.statusCode === 403;
					});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/extra');
			}).then(done, done.fail);
		});
		it('adds extra methods to an existing path', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': { methods: ['GET', 'POST']}}, awsRegion)
			.then(function () {
				return retry(function () {
						var url = apiUrl('original/echo');
						return got.post(url);
					}, 3000, 5, function (err) {
						return err.statusCode === 403;
					});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/echo');
			}).then(done, done.fail);
		});


		it('preserves old stage variables', function (done) {
				return apiGateway.createDeploymentAsync({
					restApiId: apiId,
					stageName: 'original',
					variables: {
						lambdaVersion: 'original',
						authKey: 'abs123',
						authBucket: 'bucket123'
					}
				}).then(function () {
					return underTest(newObjects.lambdaFunction, 'original', apiId, {'extra': { methods: ['GET']}}, awsRegion);
				})
				.then(function () {
					return retry(
						function () {
							return got.get(apiUrl('original/extra'));
						}, 3000, 5, function (err) {
							return err.statusCode === 403;
						});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.env).toEqual({
						lambdaVersion: 'original',
						authKey: 'abs123',
						authBucket: 'bucket123'
					});
				}).then(done, done.fail);
			});


	});


});
