/*global beforeEach, afterEach, describe, expect, require, console, jasmine, it*/
var underTest = require('../src/tasks/rebuild-web-api'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	querystring = require('querystring'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	callApi = require('../src/util/call-api'),
	awsRegion = 'us-east-1';
describe('rebuildWebApi', function () {
	'use strict';
	var workingdir, testRunName, newObjects, apiId, apiRouteConfig,
		apiGateway = Promise.promisifyAll(new aws.APIGateway({region: awsRegion})),
		invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(apiId, awsRegion, url, options);
		};
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 40000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
		apiRouteConfig = {version: 2, routes: { echo: {'GET': {} } }};
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
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(done, done.fail);
		});
		describe('request parameter processing', function () {
			it('captures query string parameters', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo?name=mike&' + encodeURIComponent('to=m') + '=' + encodeURIComponent('val,a=b'));
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.queryString).toEqual({name: 'mike', 'to=m': 'val,a=b'});
				}).then(done, function (e) {
					console.log(e);
					done.fail(e);
				});
			});
			it('captures headers', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'auth-head': 'auth3-val'}
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.headers['auth-head']).toEqual('auth3-val');
				}).then(done, done.fail);
			});
			it('captures stage variables', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
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
					return invoke ('fromtest/echo');
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
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'content-type': 'application/x-www-form-urlencoded'},
						body: querystring.stringify({name: 'tom', surname: 'bond'}),
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.post).toEqual({name: 'tom', surname: 'bond'});
				}).then(done, done.fail);
			});
		});
		it('creates multiple methods for the same resource', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {echo: { GET: {}, POST: {}, PUT: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo', {method: 'PUT'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('PUT');
				expect(params.context.path).toEqual('/echo');
			}).then(done, done.fail);
		});
		it('creates multiple resources for the same api', function (done) {
			apiRouteConfig.routes.hello = {POST: {}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return invoke('original/hello', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/hello');
			}).then(done, done.fail);
		});
		it('creates OPTIONS handlers for CORS', function (done) {
			apiRouteConfig.routes.hello = {POST: {}, GET: {}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/echo', {method: 'OPTIONS'});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-methods']).toEqual('GET,OPTIONS');
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(function () {
				return invoke('original/hello', {method: 'OPTIONS'});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-methods']).toEqual('POST,GET,OPTIONS');
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(done, done.fail);
		});
	});
	describe('response customisation', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/error-handling/*', workingdir);
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
		describe('handles success', function () {
			it('returns 200 and json template if not customised', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {}}}}, awsRegion)
				.then(function () {
					return callApi(apiId, awsRegion, 'latest/test?name=timmy');
				}).then(function (response) {
					expect(response.body).toEqual('"timmy is OK"');
					expect(response.statusCode).toEqual(200);
					expect(response.headers['content-type']).toEqual('application/json');
				}).then(done, done.fail);
			});
			it('returns a custom code when specified as a number', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {success: 202}}}}, awsRegion)
				.then(function () {
					return callApi(apiId, awsRegion, 'latest/test?name=timmy');
				}).then(function (response) {
					expect(response.body).toEqual('"timmy is OK"');
					expect(response.statusCode).toEqual(202);
					expect(response.headers['content-type']).toEqual('application/json');
				}).then(done, done.fail);
			});
			it('returns a custom code when specified as an object', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {success: {code: 202}}}}}, awsRegion)
				.then(function () {
					return callApi(apiId, awsRegion, 'latest/test?name=timmy');
				}).then(function (response) {
					expect(response.body).toEqual('"timmy is OK"');
					expect(response.statusCode).toEqual(202);
					expect(response.headers['content-type']).toEqual('application/json');
				}).then(done, done.fail);
			});
			it('resolves with the location header for 3xx codes', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {success: 301}}}}, awsRegion)
				.then(function () {
					return callApi(apiId, awsRegion, 'latest/test?name=timmy');
				}).then(function (response) {
					expect(response.body).toEqual('');
					expect(response.statusCode).toEqual(301);
					expect(response.headers.location).toEqual('timmy is OK');
				}).then(done, done.fail);
			});
			['text/html', 'text/plain', 'application/xml', 'text/xml'].forEach(function (contentType) {
				it('returns unescaped ' + contentType + ' if required', function (done) {
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {success: {contentType: contentType}}}}}, awsRegion)
					.then(function () {
						return callApi(apiId, awsRegion, 'latest/test?name=timmy');
					}).then(function (response) {
						expect(response.body).toEqual('timmy is OK');
						expect(response.statusCode).toEqual(200);
						expect(response.headers['content-type']).toEqual(contentType);
					}).then(done, done.fail);
				});
			});
		});
		describe('handles errors gracefully', function () {
			describe('when no error configuration provided', function () {
				beforeEach(function (done) {
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {}}}}, awsRegion).then(done, done.fail);
				});
				it('responds to successful requests with 200', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=timmy').then(function (response) {
						expect(response.body).toEqual('"timmy is OK"');
						expect(response.statusCode).toEqual(200);
					}).then(done, done.fail);
				});
				it('responds to text thrown as 500', function (done) {
					callApi(apiId, awsRegion, 'latest/test', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('{"errorMessage":"name not provided"}');
						expect(response.statusCode).toEqual(500);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
				it('responds to context.fail as 500', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=mik', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('{"errorMessage":"name too short"}');
						expect(response.statusCode).toEqual(500);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
				it('responds to Error thrown as 500', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=' + encodeURIComponent(' '), {resolveErrors: true}).then(function (response) {
						var error = JSON.parse(response.body);
						expect(error.errorMessage).toEqual('name is blank');
						expect(error.errorType).toEqual('Error');
						expect(response.statusCode).toEqual(500);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
			});
			describe('when the method has an error code', function () {
				beforeEach(function (done) {
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {error: 503}}}}, awsRegion).then(done, done.fail);
				});
				it('responds to successful requests with 200', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=timmy').then(function (response) {
						expect(response.body).toEqual('"timmy is OK"');
						expect(response.statusCode).toEqual(200);
					}).then(done, done.fail);
				});
				it('responds to text thrown with configured error code', function (done) {
					callApi(apiId, awsRegion, 'latest/test', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('{"errorMessage":"name not provided"}');
						expect(response.statusCode).toEqual(503);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
				it('responds to context.fail with configured error code', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=mik', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('{"errorMessage":"name too short"}');
						expect(response.statusCode).toEqual(503);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
				it('responds to Error thrown with configured error code', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=' + encodeURIComponent(' '), {resolveErrors: true}).then(function (response) {
						var error = JSON.parse(response.body);
						expect(error.errorMessage).toEqual('name is blank');
						expect(error.errorType).toEqual('Error');
						expect(response.statusCode).toEqual(503);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
			});
			describe('when the method has an error code as an object', function () {
				beforeEach(function (done) {
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {error: {code: 503}}}}}, awsRegion).then(done, done.fail);
				});
				it('responds to successful requests with 200', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=timmy').then(function (response) {
						expect(response.body).toEqual('"timmy is OK"');
						expect(response.statusCode).toEqual(200);
					}).then(done, done.fail);
				});
				it('responds to text thrown with configured error code', function (done) {
					callApi(apiId, awsRegion, 'latest/test', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('{"errorMessage":"name not provided"}');
						expect(response.statusCode).toEqual(503);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
			});

			describe('when the method has an error content type text/plain', function () {
				beforeEach(function (done) {
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {error: {code: 503, contentType: 'text/plain'}}}}}, awsRegion).then(done, done.fail);
				});
				it('responds to successful requests with 200', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=timmy').then(function (response) {
						expect(response.body).toEqual('"timmy is OK"');
						expect(response.statusCode).toEqual(200);
					}).then(done, done.fail);
				});
				it('responds to text thrown with only the text message', function (done) {
					callApi(apiId, awsRegion, 'latest/test', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('name not provided');
						expect(response.statusCode).toEqual(503);
						expect(response.headers['content-type']).toEqual('text/plain');
					}).then(done, done.fail);
				});
				it('responds to context.fail with only the text message', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=mik', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('name too short');
						expect(response.statusCode).toEqual(503);
						expect(response.headers['content-type']).toEqual('text/plain');
					}).then(done, done.fail);
				});
				it('responds to Error thrown with only the text message', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=' + encodeURIComponent(' '), {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('name is blank');
						expect(response.statusCode).toEqual(503);
						expect(response.headers['content-type']).toEqual('text/plain');
					}).then(done, done.fail);
				});
			});
			describe('when the method asks for error code to be 200', function () {
				beforeEach(function (done) {
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 2, routes: {test: {GET: {error: 200}}}}, awsRegion).then(done, done.fail);
				});
				it('responds to successful requests with 200', function (done) {
					callApi(apiId, awsRegion, 'latest/test?name=timmy').then(function (response) {
						expect(response.body).toEqual('"timmy is OK"');
						expect(response.statusCode).toEqual(200);
					}).then(done, done.fail);
				});
				it('responds to text thrown with 200', function (done) {
					callApi(apiId, awsRegion, 'latest/test', {resolveErrors: true}).then(function (response) {
						expect(response.body).toEqual('{"errorMessage":"name not provided"}');
						expect(response.statusCode).toEqual(200);
						expect(response.headers['content-type']).toEqual('application/json');
					}).then(done, done.fail);
				});
			});
		});
	});

	describe('when working with an existing api', function () {
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
				apiRouteConfig.routes.hello = {POST: {}};
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion);
			}).then(done, done.fail);
		});
		it('adds extra paths from the new definition', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {extra: { GET: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/extra');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/extra');
			}).then(done, done.fail);
		});
		it('adds extra methods to an existing path', function (done) {
			apiRouteConfig.routes.echo.POST = {};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/echo', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/echo');
			}).then(done, done.fail);
		});
		it('preserves old stage variables', function (done) {
			apiGateway.createDeploymentAsync({
				restApiId: apiId,
				stageName: 'original',
				variables: {
					lambdaVersion: 'original',
					authKey: 'abs123',
					authBucket: 'bucket123'
				}
			}).then(function () {
				return underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {extra: { GET: {}}}}, awsRegion);
			}).then(function () {
				return invoke('original/extra');
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
	describe('configuration versions', function () {
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

		it('upgrades v1 configuration if provided', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {'echo': {methods: ['GET', 'POST']}, 'hello': {methods : ['PUT']}}, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return invoke('original/hello', {method: 'PUT'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('PUT');
				expect(params.context.path).toEqual('/hello');
			}).then(done, done.fail);
		});
	});
});
