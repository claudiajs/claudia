/*global beforeEach, afterEach, describe, expect, require, console, jasmine, it*/
var underTest = require('../src/tasks/rebuild-web-api'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	Promise = require('bluebird'),
	querystring = require('querystring'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	callApi = require('../src/util/call-api'),
	retriableWrap = require('../src/util/wrap'),
	awsRegion = 'us-east-1';
describe('rebuildWebApi', function () {
	'use strict';
	var workingdir, testRunName, newObjects, apiId, apiRouteConfig,
		apiGateway = retriableWrap('apiGateway', Promise.promisifyAll(new aws.APIGateway({region: awsRegion}))),
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
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 70000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
		apiRouteConfig = {version: 3, routes: { echo: {'GET': {} } }};
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	describe('when working with a blank api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/echo-v3/*', workingdir);
			create({name: testRunName, version: 'original', role: this.genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
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
		describe('v2 processing', function () {
			it('maps the entire response object to the lambda response body', function (done) {
				apiRouteConfig.version = 2;
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo');
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.response.context.method).toEqual('GET');
					expect(params.response.context.path).toEqual('/echo');
					expect(params.headers.v).toEqual('3');
				}).then(done, done.fail);
			});
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
			it('captures path parameters', function (done) {
				apiRouteConfig.routes['people/{personId}'] = {'GET': {} };
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/people/Marcus');
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.pathParams.personId).toEqual('Marcus');
				}).then(done, done.fail);

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
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
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
			it('captures form post variables even when the charset is provided with the content type', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'},
						body: querystring.stringify({name: 'tom', surname: 'bond'}),
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.post).toEqual({name: 'tom', surname: 'bond'});
				}).then(done, done.fail);
			});
			it('captures blank form POST variables', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'content-type': 'application/x-www-form-urlencoded'},
						body: 'name=tom&surname=&title=mr',
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.post).toEqual({name: 'tom', title: 'mr', surname: ''});
				}).then(done, done.fail);
			});
			it('captures text/xml request bodies', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<test>1234</test>';
					return invoke('original/echo', {
						headers: {'Content-Type': 'text/xml'},
						body: xml,
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.body).toEqual('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<test>1234</test>');
				}).then(done, done.fail);
			});
		});

		it('creates multiple methods for the same resource', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {echo: { GET: {}, POST: {}, PUT: {}}}}, awsRegion)
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
		it('maps sub-resources with intermediate paths', function (done) {
			apiRouteConfig.routes['echo/sub/res'] = {POST: {}};
			apiRouteConfig.routes['echo/hello'] = {POST: {}};
			apiRouteConfig.routes['sub/hello'] = {POST: {}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo/sub/res', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/echo/sub/res');
			}).then(function () {
				return invoke('original/sub/hello', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/sub/hello');
			}).then(function () {
				return invoke('original/echo/hello', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/echo/hello');
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
		it('sets apiKeyRequired if requested', function (done) {
			var echoResourceId;
			apiRouteConfig.routes.echo.POST = {apiKeyRequired: true};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return apiGateway.getResourcesAsync({
					restApiId: apiId
				});
			}).then(function (resources) {
				resources.items.forEach(function (resource) {
					if (resource.path === '/echo') {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(function () {
				return apiGateway.getMethodAsync({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (methodConfig) {
				expect(methodConfig.apiKeyRequired).toBeFalsy();
			}).then(function () {
				return apiGateway.getMethodAsync({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (methodConfig) {
				expect(methodConfig.apiKeyRequired).toBeTruthy();
			}).then(done, done.fail);
		});
		it('creates multiple resources for the same api', function (done) {
			apiRouteConfig.routes['hello/res'] = {POST: {}};
			apiRouteConfig.routes.hello = {POST: {}};
			apiRouteConfig.routes[''] = {GET: {}};
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
			}).then(function () {
				return invoke('original/hello/res', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/hello/res');
			}).then(function () {
				return invoke('original/');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/');
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
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
		it('appends CORS to all methods', function (done) {
			apiRouteConfig.routes.hello = {POST: {}, GET: {}};
			apiRouteConfig.routes[''] = {GET: {}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/echo', {method: 'GET'});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(function () {
				return invoke('original/hello', {method: 'GET'});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(function () {
				return invoke('original/hello', {method: 'POST'});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(function () {
				return invoke('original/', {method: 'GET'});
			}).then(function (contents) {
				expect(contents.headers['access-control-allow-origin']).toEqual('*');
			}).then(done, done.fail);
		});
	});
	describe('legacy v2 response customisation', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/error-handling/*', workingdir);
			create({name: testRunName, version: 'original', role: this.genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
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

	});
	describe('response customisation', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/error-handling-v3/*', workingdir);
			create({name: testRunName, version: 'original', role: this.genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
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
		describe('custom headers', function () {
			it('adds headers specified as arrays', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'echo': { 'POST': { success: { headers: ['name', 'surname']}}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo?name=timmy', {
						headers: {'content-type': 'application/json'},
						body: JSON.stringify({headers: {name: 'tom', surname: 'bond'}}),
						method: 'POST'
					});
				}).then(function (response) {
					expect(response.headers.name).toEqual('tom');
					expect(response.headers.surname).toEqual('bond');
				}).then(done, function (e) {
					console.log(e);
					done.fail();
				});
			});
			it('adds headers specified as objects', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'echo': { 'POST': { success: { headers: {name: 'Mike', surname: 'Smith'}}}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo?name=timmy', {
						headers: {'content-type': 'application/json'},
						body: JSON.stringify({headers: {name: 'tom', surname: 'bond'}}),
						method: 'POST'
					});
				}).then(function (response) {
					expect(response.headers.name).toEqual('tom');
					expect(response.headers.surname).toEqual('bond');
				}).then(done, function (e) {
					console.log(e);
					done.fail();
				});
			});
			it('can override standard headers', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'echo': { 'POST': { success: { headers: ['Content-Type', 'Access-Control-Allow-Origin']}}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo?name=timmy', {
						headers: {'content-type': 'application/json'},
						body: JSON.stringify({headers: {'Content-Type': 'text/markdown', 'Access-Control-Allow-Origin': 'customCors'}}),
						method: 'POST'
					});
				}).then(function (response) {
					expect(response.headers['content-type']).toEqual('text/markdown');
					expect(response.headers['access-control-allow-origin']).toEqual('customCors');
				}).then(done, function (e) {
					console.log(e);
					done.fail();
				});

			});
		});
		describe('handles success', function () {
			it('returns 200 and json template if not customised', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {}}}}, awsRegion)
				.then(function () {
					return callApi(apiId, awsRegion, 'latest/test?name=timmy');
				}).then(function (response) {
					expect(response.body).toEqual('"timmy is OK"');
					expect(response.statusCode).toEqual(200);
					expect(response.headers['content-type']).toEqual('application/json');
				}).then(done, done.fail);
			});
			it('returns a custom code when specified as a number', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {success: 202}}}}, awsRegion)
				.then(function () {
					return callApi(apiId, awsRegion, 'latest/test?name=timmy');
				}).then(function (response) {
					expect(response.body).toEqual('"timmy is OK"');
					expect(response.statusCode).toEqual(202);
					expect(response.headers['content-type']).toEqual('application/json');
				}).then(done, done.fail);
			});
			it('returns a custom code when specified as an object', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {success: {code: 202}}}}}, awsRegion)
				.then(function () {
					return callApi(apiId, awsRegion, 'latest/test?name=timmy');
				}).then(function (response) {
					expect(response.body).toEqual('"timmy is OK"');
					expect(response.statusCode).toEqual(202);
					expect(response.headers['content-type']).toEqual('application/json');
				}).then(done, done.fail);
			});
			it('resolves with the location header for 3xx codes', function (done) {
				underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {success: 301}}}}, awsRegion)
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
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {success: {contentType: contentType}}}}}, awsRegion)
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
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {}}}}, awsRegion).then(done, done.fail);
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
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {error: 503}}}}, awsRegion).then(done, done.fail);
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
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {error: {code: 503}}}}}, awsRegion).then(done, done.fail);
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
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {error: {code: 503, contentType: 'text/plain'}}}}}, awsRegion).then(done, done.fail);
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
					underTest(newObjects.lambdaFunction, 'latest', apiId, {version: 3, routes: {test: {GET: {error: 200}}}}, awsRegion).then(done, done.fail);
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
			shell.cp('-r', 'spec/test-projects/echo-v3/*', workingdir);
			create({name: testRunName, version: 'original', role: this.genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
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
				apiRouteConfig.routes[''] = {GET: {}, PUT: {}};
				apiRouteConfig.routes.sub = {GET: {}, PUT: {}};
				apiRouteConfig.routes['sub/mapped/sub2'] = {GET: {}, PUT: {}};
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion);
			}).then(done, done.fail);
		});
		it('adds extra paths from the new definition', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {extra: { GET: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/extra');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/extra');
			}).then(done, done.fail);
		});
		it('adds subresources mapped with intermediate paths', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {'sub/map2/map3': { GET: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/sub/map2/map3');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/sub/map2/map3');
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
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
		it('replaces root path handlers', function (done) {
			apiRouteConfig.routes[''] = { POST: {}, GET: {} };
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('POST');
				expect(params.context.path).toEqual('/');
			}).then(function () {
				return invoke('original/', {method: 'GET'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.context.method).toEqual('GET');
				expect(params.context.path).toEqual('/');
			}).then(function () {
				return invoke('original/', {method: 'PUT', retry: false, resolveErrors: true});
			}).then(function (response) {
				expect(response.statusCode).toEqual(403);
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
				return underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {extra: { GET: {}}}}, awsRegion);
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
			shell.cp('-r', 'spec/test-projects/echo-v3/*', workingdir);
			create({name: testRunName, version: 'original', role: this.genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
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
