/*global beforeEach, afterEach, describe, expect, require, console, jasmine, it, describe*/
var underTest = require('../src/tasks/rebuild-web-api'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	Promise = require('bluebird'),
	querystring = require('querystring'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	callApi = require('../src/util/call-api'),
	retriableWrap = require('../src/util/retriable-wrap'),
	ArrayLogger = require('../src/util/array-logger'),
	awsRegion = 'us-east-1';
describe('rebuildWebApi', function () {
	'use strict';
	var workingdir, testRunName, newObjects, apiId, apiRouteConfig,
		apiGateway = retriableWrap(Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), function () {}, /Async$/),
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
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 150000;
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
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
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
			apiRouteConfig.corsHandlers = false;
		});
		it('creates and links an API to a lambda version', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, done.fail);
		});
		describe('request parameter processing', function () {
			it('captures query string parameters', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo?name=mike&' + encodeURIComponent('to=m') + '=' + encodeURIComponent('val,a=b'));
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.queryStringParameters).toEqual({name: 'mike', 'to=m': 'val,a=b'});
				}).then(done, function (e) {
					console.log(e);
					done.fail(e);
				});
			});
			it('captures quoted query string parameters', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo?name=O\'Reilly');
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.queryStringParameters).toEqual({name: 'O\'Reilly'});
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
					expect(params.pathParameters.personId).toEqual('Marcus');
				}).then(done, done.fail);

			});
			it('captures path parameters with quotes', function (done) {
				apiRouteConfig.routes['people/{personId}'] = {'GET': {} };
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/people/Mar\'cus');
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.pathParameters.personId).toEqual('Mar\'cus');
				}).then(done, done.fail);

			});
			it('captures headers', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'auth-head': 'auth3-val', 'Capital-Head': 'Capital-Val'}
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.headers['auth-head']).toEqual('auth3-val');
					expect(params.headers['Capital-Head']).toEqual('Capital-Val');
				}).then(done, done.fail);
			});
			it('captures headers with quotes', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'auth-head': 'auth3\'val', 'Capital-Head': 'Capital\'Val'}
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.headers['auth-head']).toEqual('auth3\'val');
					expect(params.headers['Capital-Head']).toEqual('Capital\'Val');
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
					expect(params.stageVariables).toEqual({
						lambdaVersion: 'original',
						authKey: 'abs123',
						authBucket: 'bucket123'
					});
				}).then(done, done.fail);
			});
			it('captures form post variables', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'content-type': 'application/x-www-form-urlencoded'},
						body: querystring.stringify({name: 'tom', surname: 'bond'}),
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.body).toEqual(querystring.stringify({name: 'tom', surname: 'bond'}));
				}).then(done, done.fail);
			});
			it('captures quoted form POST variables correctly', function (done) {
				var body = 'first_name=Jobin\'s&receiver_email=xxx@yyy.com&address_country_code=CA&payer_business_name=Jobin\'s Services&address_state=Quebec';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'content-type': 'application/x-www-form-urlencoded'},
						body: body,
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.body).toEqual(body);
				}).then(done, function (result) {
					console.log(result);
					done.fail(result);
				});
			});
			it('captures text/xml request bodies', function (done) {
				var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<test>1234</test>';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'Content-Type': 'text/xml'},
						body: xml,
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.body).toEqual(xml);
				}).then(done, done.fail);
			});
			it('captures application/xml request bodies', function (done) {
				var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<test>1234</test>';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'Content-Type': 'application/xml'},
						body: xml,
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.body).toEqual(xml);
				}).then(done, done.fail);
			});
			it('captures text/plain request bodies', function (done) {
				var textContent = 'this is just plain text';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'Content-Type': 'text/plain'},
						body: textContent,
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.body).toEqual(textContent);
				}).then(done, done.fail);
			});

			it('captures quoted text/plain request bodies', function (done) {
				var textContent = 'this is single \' quote';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'Content-Type': 'text/plain'},
						body: textContent,
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(params.body).toEqual(textContent);
				}).then(done, done.fail);
			});
			it('captures quoted application/json request bodies', function (done) {
				var jsonContent = {
						fileKey : 'Jim\'s map.mup',
						license : {version: 2, accountType: 'mindmup-gold', account: 'dave', signature: 'signature-1'}
					},
					textContent = JSON.stringify(jsonContent);
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						headers: {'Content-Type': 'application/json'},
						body: textContent,
						method: 'POST'
					});
				}).then(function (contents) {
					var params = JSON.parse(contents.body);
					expect(JSON.parse(params.body)).toEqual(jsonContent);
				}).then(done, done.fail);
			});
		});

		it('creates multiple methods for the same resource', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {echo: { GET: {}, POST: {}, PUT: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo', {method: 'PUT'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('PUT');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, done.fail);
		});
		it('maps ANY method', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {echo: { ANY: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo', {method: 'PUT'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('PUT');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, function (e) {
				console.log(e);
				done.fail();
			});

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
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(function () {
				return invoke('original/echo/sub/res', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo/sub/res');
			}).then(function () {
				return invoke('original/sub/hello', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/sub/hello');
			}).then(function () {
				return invoke('original/echo/hello', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo/hello');
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
		it('sets authorizationType if requested', function (done) {
			var echoResourceId;
			apiRouteConfig.routes.echo.POST = {authorizationType: 'AWS_IAM'};
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
				expect(methodConfig.authorizationType).toEqual('NONE');
			}).then(function () {
				return apiGateway.getMethodAsync({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (methodConfig) {
				expect(methodConfig.authorizationType).toEqual('AWS_IAM');
			}).then(done, done.fail);
		});
		it('sets caller credentials when invokeWithCredentials is true', function (done) {
			var echoResourceId;
			apiRouteConfig.routes.echo.POST = {
				invokeWithCredentials: true
			};
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
				return apiGateway.getIntegrationAsync({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (integrationConfig) {
				expect(integrationConfig.credentials).toBeUndefined();
			}).then(function () {
				return apiGateway.getIntegrationAsync({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (integrationConfig) {
				expect(integrationConfig.credentials).toEqual('arn:aws:iam::*:user/*');
			}).then(done, done.fail);
		});
		it('sets custom credentials when invokeWithCredentials is a string', function (done) {
			var iam = retriableWrap(Promise.promisifyAll(new aws.IAM({region: awsRegion})), function () {}, /Async$/),
				echoResourceId,
				testCredentials;
			iam.getUserAsync().then(function (data) {
				testCredentials = data.User.Arn;
				apiRouteConfig.routes.echo.POST = {
					invokeWithCredentials: testCredentials
				};
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion);
			}).then(function () {
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
				return apiGateway.getIntegrationAsync({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (integrationConfig) {
				expect(integrationConfig.credentials).toBeUndefined();
			}).then(function () {
				return apiGateway.getIntegrationAsync({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (integrationConfig) {
				expect(integrationConfig.credentials).toEqual(testCredentials);
			}).then(done, done.fail);
		});
		it('does not set credentials or authorizationType if invokeWithCredentials is invalid', function (done) {
			var echoResourceId;
			apiRouteConfig.routes.echo.POST = {
				invokeWithCredentials: 'invalid_credentials'
			};
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
				return apiGateway.getIntegrationAsync({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (integrationConfig) {
				expect(integrationConfig.credentials).toBeUndefined();
			}).then(function () {
				return apiGateway.getMethodAsync({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (methodConfig) {
				expect(methodConfig.authorizationType).toEqual('NONE');
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
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(function () {
				return invoke('original/hello', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/hello');
			}).then(function () {
				return invoke('original/hello/res', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/hello/res');
			}).then(function () {
				return invoke('original/');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/');
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
	});
	describe('custom authorizers', function () {
		var authorizerLambdaName, lambda;
		beforeEach(function (done) {
			var authorizerLambdaDir = path.join(workingdir, 'authorizer'),
				genericRole = this.genericRole;
			lambda = new aws.Lambda({region: awsRegion});
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
			shell.cp('-r', 'spec/test-projects/echo/*', authorizerLambdaDir);

			apiRouteConfig.corsHandlers = false;
			create({name: testRunName, version: 'original', role: genericRole, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(function () {
				return apiGateway.createRestApiAsync({name: testRunName});
			}).then(function (result) {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(function () {
				return create({name: testRunName + 'auth', version: 'original', role: genericRole, region: awsRegion, source: authorizerLambdaDir, handler: 'main.handler'});
			}).then(function (result) {
				authorizerLambdaName = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		afterEach(function (done) {
			lambda.deleteFunction({FunctionName: authorizerLambdaName}).promise().then(done, done.fail);
		});
		it('assigns authorizers by name', function (done) {
			var authorizerIds = {}, echoResourceId;
			apiRouteConfig.authorizers = {
				first: { lambdaName: authorizerLambdaName, headerName: 'Authorization' },
				second: { lambdaName: authorizerLambdaName, headerName: 'UserId' }
			};
			apiRouteConfig.routes.echo.POST = {customAuthorizer: 'second'};
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
				return apiGateway.getAuthorizersAsync({
					restApiId: apiId
				});
			}).then(function (authorizers) {
				authorizerIds[authorizers.items[0].name] = authorizers.items[0].id;
				authorizerIds[authorizers.items[1].name] = authorizers.items[1].id;
			}).then(function () {
				return apiGateway.getMethodAsync({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (methodConfig) {
				expect(methodConfig.authorizationType).toEqual('NONE');
				expect(methodConfig.authorizerId).toBeUndefined();
			}).then(function () {
				return apiGateway.getMethodAsync({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(function (methodConfig) {
				expect(methodConfig.authorizationType).toEqual('CUSTOM');
				expect(methodConfig.authorizerId).toEqual(authorizerIds.second);
			}).then(done, done.fail);
		});
	});

	describe('CORS handling', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/api-gw-proxy-headers/*', workingdir);
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

		describe('without custom CORS options', function () {
			it('creates OPTIONS handlers for CORS', function (done) {
				apiRouteConfig.routes.hello = {POST: {}, GET: {}};
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo', {method: 'OPTIONS'});
				}).then(function (contents) {
					expect(contents.headers['access-control-allow-methods']).toEqual('DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT');
					expect(contents.headers['access-control-allow-headers']).toEqual('Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token');
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
				}).then(function () {
					return invoke('original/hello', {method: 'OPTIONS'});
				}).then(function (contents) {
					expect(contents.headers['access-control-allow-methods']).toEqual('DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT');
					expect(contents.headers['access-control-allow-headers']).toEqual('Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token');
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
				}).then(done, done.fail);
			});
		});
		describe('when corsHeaders are set', function () {
			beforeEach(function () {
				apiRouteConfig.corsHeaders = 'X-Custom-Header,X-Api-Key';
			});
			it('uses the headers for OPTIONS handlers', function (done) {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo', {method: 'OPTIONS'});
				}).then(function (contents) {
					expect(contents.headers['access-control-allow-headers']).toEqual('X-Custom-Header,X-Api-Key');
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
				}).then(done, done.fail);
			});
		});
		describe('when corsHandlers are set to false', function () {
			beforeEach(function (done) {
				apiRouteConfig.corsHandlers = false;
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion).then(done, done.fail);
			});
			it('does not create OPTIONS handlers for CORS', function (done) {
				invoke('original/echo', {method: 'OPTIONS', resolveErrors: true})
				.then(function (response) {
					expect(response.statusCode).toEqual(403);
					expect(response.headers['content-type']).toEqual('application/json');
					expect(response.headers['access-control-allow-methods']).toBeFalsy();
					expect(response.headers['access-control-allow-headers']).toBeFalsy();
					expect(response.headers['access-control-allow-origin']).toBeFalsy();
				}).then(done, done.fail);
			});
		});
		describe('when corsHandlers are set to true', function () {
			beforeEach(function () {
				apiRouteConfig.corsHandlers = true;
			});
			it('routes the OPTIONS handler to Lambda', function (done) {
				apiRouteConfig.routes.hello = {POST: {}, GET: {}};
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(function () {
					return invoke('original/echo', {
						method: 'OPTIONS',
						headers: {'content-type': 'text/plain'},
						body: JSON.stringify({
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Headers': 'X-Custom-Header,X-Api-Key',
							'Access-Control-Allow-Origin': 'custom-origin'
						})
					});
				}).then(function (contents) {
					expect(contents.headers['access-control-allow-methods']).toEqual('GET,OPTIONS');
					expect(contents.headers['access-control-allow-headers']).toEqual('X-Custom-Header,X-Api-Key');
					expect(contents.headers['access-control-allow-origin']).toEqual('custom-origin');
				}).then(done, function (e) {
					console.log(e);
					done.fail();
				});
			});
		});
	});

	describe('when working with an existing api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
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
				apiRouteConfig.corsHandlers = false;
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion);
			}).then(done, done.fail);
		});
		it('adds extra paths from the new definition', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {extra: { GET: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/extra');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/extra');
			}).then(done, done.fail);
		});
		it('adds subresources mapped with intermediate paths', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {'sub/map2/map3': { GET: {}}}}, awsRegion)
			.then(function () {
				return invoke('original/sub/map2/map3');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/sub/map2/map3');
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
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, done.fail);
		});
		it('replaces root path handlers', function (done) {
			apiRouteConfig.routes[''] = { POST: {}, GET: {} };
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(function () {
				return invoke('original/', {method: 'POST'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/');
			}).then(function () {
				return invoke('original/', {method: 'GET'});
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/');
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
				return underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 2, routes: {extra: { GET: {}}}}, awsRegion);
			}).then(function () {
				return invoke('original/extra');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'original',
					authKey: 'abs123',
					authBucket: 'bucket123'
				});
			}).then(done, done.fail);
		});
	});
	describe('logging', function () {
		var logger;
		beforeEach(function (done) {
			logger = new ArrayLogger();
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
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
		it('logs execution', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger).then(function () {
				expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
					'apigateway.getResources',
					'apigateway.createResource',
					'apigateway.putMethod',
					'apigateway.putIntegration',
					'apigateway.putMethodResponse',
					'apigateway.putIntegrationResponse',
					'apigateway.createDeployment'
				]);
				expect(logger.getApiCallLogForService('sts', true)).toEqual(['sts.getCallerIdentity']);
			}).then(done, done.fail);
		});
	});
	describe('configuration cashing', function () {
		var logger;
		beforeEach(function (done) {
			logger = new ArrayLogger();
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
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
		it('stores the configuration hash in a stage variable', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash').then(function () {
				return invoke('original/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'original',
					configHash: 'nWvdJ3sEScZVJeZSDq4LZtDsCZw9dDdmsJbkhnuoZIY='
				});
			}).then(done, done.fail);
		});
		it('runs through the whole deployment if there was no previous stage by this name', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined, 'configHash').then(function () {
				return underTest(newObjects.lambdaFunction, 'latest', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(function () {
				expect(logger.getApiCallLogForService('apigateway', true)).toContain('apigateway.createResource');
				expect(logger.getStageLog(true)).not.toContain('Reusing cached API configuration');
			}).then(done, done.fail);
		});
		it('runs throough the whole deployment if there was no config hash in the previous stage with the same name', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined).then(function () {
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(function () {
				expect(logger.getApiCallLogForService('apigateway', true)).toContain('apigateway.createResource');
				expect(logger.getStageLog(true)).not.toContain('Reusing cached API configuration');
			}).then(done, done.fail);
		});
		it('runs through the whole deployment if there was a previous config hash but was different', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined, 'configHash').then(function () {
				apiRouteConfig.routes.echo.POST = {};
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(function () {
				expect(logger.getApiCallLogForService('apigateway', true)).toContain('apigateway.createResource');
				expect(logger.getStageLog()).not.toContain('Reusing cached API configuration');
			}).then(done, done.fail);
		});
		it('skips deleting and creating resources if there was a previous stage with the same name and config hash', function (done) {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined, 'configHash').then(function () {
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(function () {
				expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
					'apigateway.getStage'
				]);
				expect(logger.getStageLog(true)).toContain('Reusing cached API configuration');
			}).then(done, done.fail);

		});
	});
});
