/*global beforeEach, afterEach, describe, expect, require, console, it, describe */
const underTest = require('../src/tasks/rebuild-web-api'),
	destroyObjects = require('./util/destroy-objects'),
	genericTestRole = require('./util/generic-role'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	querystring = require('querystring'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	callApi = require('../src/util/call-api'),
	retriableWrap = require('../src/util/retriable-wrap'),
	ArrayLogger = require('../src/util/array-logger'),
	awsRegion = require('./util/test-aws-region');
describe('rebuildWebApi', () => {
	'use strict';
	let workingdir, testRunName, newObjects, apiId, apiRouteConfig;
	const apiGateway = retriableWrap(new aws.APIGateway({region: awsRegion})),
		invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(apiId, awsRegion, url, options);
		},
		getCustomGatewayResponses = function () {
			return apiGateway.getGatewayResponsesPromise({ restApiId: apiId })
			.then(result => result.items.filter(f => !f.defaultResponse));
		},
		getResourceForPath = function (path) {
			return apiGateway.getResourcesPromise({
				restApiId: apiId
			})
			.then(resources => {
				const resource = resources.items.find(resource => (resource.path === path));
				return resource && resource.id;
			});
		};


	beforeEach(() => {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
		apiRouteConfig = {version: 4, routes: { echo: {'GET': {} } }};
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	describe('when working with a blank api', () => {
		beforeEach(done => {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);
			apiRouteConfig.corsHandlers = false;
		});
		it('creates and links an API to a lambda version', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, done.fail);
		});
		describe('request parameter processing', () => {
			it('captures query string parameters', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo?name=mike&' + encodeURIComponent('to=m') + '=' + encodeURIComponent('val,a=b'));
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.queryStringParameters).toEqual({name: 'mike', 'to=m': 'val,a=b'});
				}).then(done, e => {
					console.log(e);
					done.fail(e);
				});
			});
			it('captures quoted query string parameters', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo?name=O\'Reilly');
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.queryStringParameters).toEqual({name: 'O\'Reilly'});
				}).then(done, e => {
					console.log(e);
					done.fail(e);
				});
			});
			it('captures path parameters', done => {
				apiRouteConfig.routes['people/{personId}'] = {'GET': {} };
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/people/Marcus');
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.pathParameters.personId).toEqual('Marcus');
				}).then(done, done.fail);

			});
			it('captures path parameters with quotes', done => {
				apiRouteConfig.routes['people/{personId}'] = {'GET': {} };
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/people/Mar\'cus');
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.pathParameters.personId).toEqual('Mar\'cus');
				}).then(done, done.fail);

			});
			it('captures headers', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'auth-head': 'auth3-val', 'Capital-Head': 'Capital-Val'}
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.headers['auth-head']).toEqual('auth3-val');
					expect(params.headers['Capital-Head']).toEqual('Capital-Val');
				}).then(done, done.fail);
			});
			it('captures headers with quotes', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'auth-head': 'auth3\'val', 'Capital-Head': 'Capital\'Val'}
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.headers['auth-head']).toEqual('auth3\'val');
					expect(params.headers['Capital-Head']).toEqual('Capital\'Val');
				}).then(done, done.fail);
			});
			it('captures stage variables', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return apiGateway.createDeploymentPromise({
						restApiId: apiId,
						stageName: 'fromtest',
						variables: {
							lambdaVersion: 'original',
							authKey: 'abs123',
							authBucket: 'bucket123'
						}
					});
				})
				.then(() => {
					return invoke ('fromtest/echo');
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.stageVariables).toEqual({
						lambdaVersion: 'original',
						authKey: 'abs123',
						authBucket: 'bucket123'
					});
				}).then(done, done.fail);
			});
			it('captures form post variables', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'content-type': 'application/x-www-form-urlencoded'},
						body: querystring.stringify({name: 'tom', surname: 'bond'}),
						method: 'POST'
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.body).toEqual(querystring.stringify({name: 'tom', surname: 'bond'}));
				}).then(done, done.fail);
			});
			it('captures quoted form POST variables correctly', done => {
				const body = 'first_name=Jobin\'s&receiver_email=xxx@yyy.com&address_country_code=CA&payer_business_name=Jobin\'s Services&address_state=Quebec';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'content-type': 'application/x-www-form-urlencoded'},
						body: body,
						method: 'POST'
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.body).toEqual(body);
				}).then(done, result => {
					console.log(result);
					done.fail(result);
				});
			});
			it('captures text/xml request bodies', done => {
				const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<test>1234</test>';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'Content-Type': 'text/xml'},
						body: xml,
						method: 'POST'
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.body).toEqual(xml);
				}).then(done, done.fail);
			});
			it('captures application/xml request bodies', done => {
				const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<test>1234</test>';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'Content-Type': 'application/xml'},
						body: xml,
						method: 'POST'
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.body).toEqual(xml);
				}).then(done, done.fail);
			});
			it('captures text/plain request bodies', done => {
				const textContent = 'this is just plain text';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'Content-Type': 'text/plain'},
						body: textContent,
						method: 'POST'
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.body).toEqual(textContent);
				}).then(done, done.fail);
			});

			it('captures quoted text/plain request bodies', done => {
				const textContent = 'this is single \' quote';
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'Content-Type': 'text/plain'},
						body: textContent,
						method: 'POST'
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(params.body).toEqual(textContent);
				}).then(done, done.fail);
			});
			it('captures quoted application/json request bodies', done => {
				const jsonContent = {
						fileKey: 'Jim\'s map.mup',
						license: {version: 2, accountType: 'mindmup-gold', account: 'dave', signature: 'signature-1'}
					},
					textContent = JSON.stringify(jsonContent);
				underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {'echo': { 'POST': {}}}}, awsRegion)
				.then(() => {
					return invoke('original/echo', {
						headers: {'Content-Type': 'application/json'},
						body: textContent,
						method: 'POST'
					});
				}).then(contents => {
					const params = JSON.parse(contents.body);
					expect(JSON.parse(params.body)).toEqual(jsonContent);
				}).then(done, done.fail);
			});
		});

		it('creates multiple methods for the same resource', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {echo: { GET: {}, POST: {}, PUT: {}}}}, awsRegion)
			.then(() => {
				return invoke('original/echo');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(() => {
				return invoke('original/echo', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(() => {
				return invoke('original/echo', {method: 'PUT'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('PUT');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, done.fail);
		});
		it('maps ANY method', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 3, routes: {echo: { ANY: {}}}}, awsRegion)
			.then(() => {
				return invoke('original/echo');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(() => {
				return invoke('original/echo', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(() => {
				return invoke('original/echo', {method: 'PUT'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('PUT');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, e => {
				console.log(e);
				done.fail();
			});

		});
		it('maps sub-resources with intermediate paths', done => {
			apiRouteConfig.routes['echo/sub/res'] = {POST: {}};
			apiRouteConfig.routes['echo/hello'] = {POST: {}};
			apiRouteConfig.routes['sub/hello'] = {POST: {}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(() => {
				return invoke('original/echo/sub/res', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo/sub/res');
			}).then(() => {
				return invoke('original/sub/hello', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/sub/hello');
			}).then(() => {
				return invoke('original/echo/hello', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo/hello');
			}).then(done, e => {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
		it('sets apiKeyRequired if requested', done => {
			let echoResourceId;
			apiRouteConfig.routes.echo.POST = {apiKeyRequired: true};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return apiGateway.getResourcesPromise({
					restApiId: apiId
				});
			}).then(resources => {
				resources.items.forEach(resource => {
					if (resource.path === '/echo') {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(methodConfig => {
				expect(methodConfig.apiKeyRequired).toBeFalsy();
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(methodConfig => {
				expect(methodConfig.apiKeyRequired).toBeTruthy();
			}).then(done, done.fail);
		});
		it('sets authorizationType if requested', done => {
			let echoResourceId;
			apiRouteConfig.routes.echo.POST = {authorizationType: 'AWS_IAM'};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return apiGateway.getResourcesPromise({
					restApiId: apiId
				});
			}).then(resources => {
				resources.items.forEach(resource => {
					if (resource.path === '/echo') {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(methodConfig => {
				expect(methodConfig.authorizationType).toEqual('NONE');
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(methodConfig => {
				expect(methodConfig.authorizationType).toEqual('AWS_IAM');
			}).then(done, done.fail);
		});
		it('sets caller credentials when invokeWithCredentials is true', done => {
			let echoResourceId;
			apiRouteConfig.routes.echo.POST = {
				invokeWithCredentials: true
			};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return apiGateway.getResourcesPromise({
					restApiId: apiId
				});
			}).then(resources => {
				resources.items.forEach(resource => {
					if (resource.path === '/echo') {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(() => {
				return apiGateway.getIntegrationPromise({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(integrationConfig => {
				expect(integrationConfig.credentials).toBeUndefined();
			}).then(() => {
				return apiGateway.getIntegrationPromise({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(integrationConfig => {
				expect(integrationConfig.credentials).toEqual('arn:aws:iam::*:user/*');
			}).then(done, done.fail);
		});
		it('sets custom credentials when invokeWithCredentials is a string', done => {
			const iam = new aws.IAM({region: awsRegion});
			let echoResourceId,
				testCredentials;
			iam.getUser().promise().then(data => {
				testCredentials = data.User.Arn;
				apiRouteConfig.routes.echo.POST = {
					invokeWithCredentials: testCredentials
				};
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion);
			}).then(() => {
				return apiGateway.getResourcesPromise({
					restApiId: apiId
				});
			}).then(resources => {
				resources.items.forEach(resource => {
					if (resource.path === '/echo') {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(() => {
				return apiGateway.getIntegrationPromise({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(integrationConfig => {
				expect(integrationConfig.credentials).toBeUndefined();
			}).then(() => {
				return apiGateway.getIntegrationPromise({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(integrationConfig => {
				expect(integrationConfig.credentials).toEqual(testCredentials);
			}).then(done, done.fail);
		});
		it('does not set credentials or authorizationType if invokeWithCredentials is invalid', done => {
			let echoResourceId;
			apiRouteConfig.routes.echo.POST = {
				invokeWithCredentials: 'invalid_credentials'
			};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return apiGateway.getResourcesPromise({
					restApiId: apiId
				});
			}).then(resources => {
				resources.items.forEach(resource => {
					if (resource.path === '/echo') {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(() => {
				return apiGateway.getIntegrationPromise({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(integrationConfig => {
				expect(integrationConfig.credentials).toBeUndefined();
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(methodConfig => {
				expect(methodConfig.authorizationType).toEqual('NONE');
			}).then(done, done.fail);
		});
		it('creates multiple resources for the same api', done => {
			apiRouteConfig.routes['hello/res'] = {POST: {}};
			apiRouteConfig.routes.hello = {POST: {}};
			apiRouteConfig.routes[''] = {GET: {}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(() => {
				return invoke('original/hello', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/hello');
			}).then(() => {
				return invoke('original/hello/res', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/hello/res');
			}).then(() => {
				return invoke('original/');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/');
			}).then(done, e => {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
	});
	describe('custom gateway response support', () => {
		beforeEach(done => {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);
			apiRouteConfig.corsHandlers = false;
		});
		it('does not add any custom responses by default', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => getCustomGatewayResponses())
			.then(result => expect(result).toEqual([]))
			.then(done, done.fail);
		});
		it('adds new custom gateway responses if required', done => {
			apiRouteConfig.customResponses = {'DEFAULT_4XX': {statusCode: 411}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => getCustomGatewayResponses())
			.then(result => {
				expect(result.length).toEqual(1);
				expect(result[0].responseType).toEqual('DEFAULT_4XX');
				expect(result[0].statusCode).toEqual('411');
			})
			.then(() => {
				return invoke('original/non-existing', {resolveErrors: true});
			}).then(response => {
				expect(response.statusCode).toEqual(411);
			}).then(done, done.fail);
		});
		it('adds multiple custom gateway responses', done => {
			const sortByResponseType = function (a, b) {
				if (a.responseType < b.responseType) {
					return -1;
				}
				if (a.responseType > b.responseType) {
					return 1;
				}
				return 0;
			};
			apiRouteConfig.customResponses = {'DEFAULT_4XX': {statusCode: 411}, 'DEFAULT_5XX': {statusCode: 511}};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => getCustomGatewayResponses())
			.then(result => {
				result.sort(sortByResponseType);
				expect(result.length).toEqual(2);
				expect(result[0].responseType).toEqual('DEFAULT_4XX');
				expect(result[0].statusCode).toEqual('411');
				expect(result[1].responseType).toEqual('DEFAULT_5XX');
				expect(result[1].statusCode).toEqual('511');
			})
			.then(() => {
				return invoke('original/non-existing', {resolveErrors: true});
			}).then(response => {
				expect(response.statusCode).toEqual(411);
			}).then(done, done.fail);
		});
		it('adds response parameters', done => {
			apiRouteConfig.customResponses = {
				'DEFAULT_4XX': {
					responseParameters: {
						'gatewayresponse.header.x-response-claudia': '\'yes\'',
						'gatewayresponse.header.x-name': 'method.request.header.name',
						'gatewayresponse.header.Access-Control-Allow-Origin': '\'a.b.c\'',
						'gatewayresponse.header.Content-Type': '\'application/json\''
					},
					statusCode: 411,
					responseTemplates: {
						'application/json': '{"custom": true, "message":$context.error.messageString}'
					}
				}
			};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => invoke('original/non-existing?key=tom', {
				headers: {'name': 'tom'},
				resolveErrors: true
			}))
			.then(response => {
				const bodyJson = JSON.parse(response.body);
				expect(bodyJson.custom).toEqual(true);
				expect(bodyJson.message).toEqual('Missing Authentication Token');
				expect(response.statusCode).toEqual(411);
				expect(response.headers['content-type']).toEqual('application/json');
				expect(response.headers['access-control-allow-origin']).toEqual('a.b.c');
				expect(response.headers['x-response-claudia']).toEqual('yes');
				expect(response.headers['x-name']).toEqual('tom');
			})
			.then(done, done.fail);
		});
		it('works with a headers shortcut', done => {
			apiRouteConfig.customResponses = {
				'DEFAULT_4XX': {
					headers: {
						'x-response-claudia': 'yes',
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': 'a.b.c'
					}
				}
			};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => invoke('original/non-existing', { resolveErrors: true }))
			.then(response => {
				expect(response.headers['content-type']).toEqual('application/json');
				expect(response.headers['access-control-allow-origin']).toEqual('a.b.c');
				expect(response.headers['x-response-claudia']).toEqual('yes');
			})
			.then(done, done.fail);
		});
		it('can combine responseParameters and headers', done => {
			apiRouteConfig.customResponses = {
				'DEFAULT_4XX': {
					responseParameters: {
						'gatewayresponse.header.x-response-claudia': '\'yes\'',
						'gatewayresponse.header.x-name': 'method.request.header.name'
					},
					headers: {
						'x-response-claudia': 'no',
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': 'a.b.c'
					},
					statusCode: 411
				}
			};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => invoke('original/non-existing?key=tom', {
				headers: {'name': 'tom'},
				resolveErrors: true
			}))
			.then(response => {
				expect(response.headers['content-type']).toEqual('application/json');
				expect(response.headers['access-control-allow-origin']).toEqual('a.b.c');
				expect(response.headers['x-response-claudia']).toEqual('no');
				expect(response.headers['x-name']).toEqual('tom');

			})
			.then(done, done.fail);
		});
	});
	describe('binary media type support', () => {
		beforeEach(done => {
			shell.cp('-r', 'spec/test-projects/api-gw-binary/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);
			apiRouteConfig = {
				version: 3,
				routes: {
					echo: {'POST': {} }
				},
				corsHandlers: false
			};
		});
		it('does not install any binary media support to an API if no specific types are requested', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => apiGateway.getRestApiPromise({restApiId: apiId}))
			.then(restApiConfig => {
				expect(restApiConfig.binaryMediaTypes).toBeUndefined();
			}).then(done, done.fail);
		});
		it('installs configured binary media type support if an API contains binaryMediaTypes', done => {
			apiRouteConfig.binaryMediaTypes = ['application/x-markdown', 'image/tiff'];
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => apiGateway.getRestApiPromise({restApiId: apiId}))
			.then(restApiConfig => {
				expect(restApiConfig.binaryMediaTypes).toEqual(['application/x-markdown', 'image/tiff']);
			}).then(done, done.fail);
		});
		it('does not add any types if binaryMediaTypes is an empty array', done => {
			apiRouteConfig.binaryMediaTypes = [];
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => apiGateway.getRestApiPromise({restApiId: apiId}))
			.then(restApiConfig => {
				expect(restApiConfig.binaryMediaTypes).toBeUndefined();
			}).then(done, done.fail);
		});
		it('does not set up base64 encoding or decoding by default', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => apiGateway.getResourcesPromise({restApiId: apiId}))
			.then(resources => resources.items.find(resource => resource.path === '/echo').id)
			.then(resourceId => apiGateway.getMethodPromise({restApiId: apiId, httpMethod: 'POST', resourceId: resourceId}))
			.then(method => {
				expect(method.methodIntegration.passthroughBehavior).toEqual('WHEN_NO_MATCH');
				expect(method.methodIntegration.contentHandling).toBeUndefined();
				expect(method.methodIntegration.integrationResponses['200'].contentHandling).toBeUndefined();
			}).then(done, done.fail);
		});
		it('allows the api configuration to override set content handling with requestContentHandling', done => {
			apiRouteConfig.routes.echo.POST.requestContentHandling = 'CONVERT_TO_BINARY';
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => apiGateway.getResourcesPromise({restApiId: apiId}))
			.then(resources => resources.items.find(resource => resource.path === '/echo').id)
			.then(resourceId => apiGateway.getMethodPromise({restApiId: apiId, httpMethod: 'POST', resourceId: resourceId}))
			.then(method => {
				expect(method.methodIntegration.contentHandling).toEqual('CONVERT_TO_BINARY');
			}).then(done, done.fail);
		});
		it('allows the api configuration to set response content handling with responseContentHandling', done => {
			apiRouteConfig.routes.echo.POST.success = { contentHandling: 'CONVERT_TO_TEXT' };
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => apiGateway.getResourcesPromise({restApiId: apiId}))
			.then(resources => resources.items.find(resource => resource.path === '/echo').id)
			.then(resourceId => apiGateway.getMethodPromise({restApiId: apiId, httpMethod: 'POST', resourceId: resourceId}))
			.then(method => {
				expect(method.methodIntegration.integrationResponses['200'].contentHandling).toEqual('CONVERT_TO_TEXT');
			}).then(done, done.fail);
		});
		it('converts recognised binary content types into base64 text', done => {
			apiRouteConfig.binaryMediaTypes = ['application/octet-stream', 'image/png'];
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo', {
					headers: {'content-type': 'application/octet-stream', 'result-content-type': 'text/plain'},
					body: 'Hello World',
					method: 'POST'
				});
			}).then(contents => {
				expect(contents.body).toEqual('SGVsbG8gV29ybGQ=');
			}).then(done, done.fail);
		});
		it('converts recognised binary content types into base64 when requestContentHandling is CONVERT_TO_TEXT', done => {
			apiRouteConfig.binaryMediaTypes = ['application/octet-stream', 'image/png'];
			apiRouteConfig.routes.echo.POST.requestContentHandling = 'CONVERT_TO_TEXT';
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo', {
					headers: {'content-type': 'application/octet-stream', 'result-content-type': 'text/plain'},
					body: 'Hello World',
					method: 'POST'
				});
			}).then(contents => {
				expect(contents.body).toEqual('SGVsbG8gV29ybGQ=');
			}).then(done, done.fail);
		});
		it('does not convert if content type is not recognised as binary', done => {
			apiRouteConfig.binaryMediaTypes = ['application/x-markdown', 'image/tiff'];
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo', {
					headers: {'content-type': 'application/octet-stream', 'result-content-type': 'text/plain'},
					body: 'Hello World',
					method: 'POST'
				});
			}).then(contents => {
				expect(contents.body).toEqual('Hello World');
			}).then(done, done.fail);
		});
		it('does not convert when requestContentHandling is set to CONVERT_TO_BINARY', done => {
			apiRouteConfig.binaryMediaTypes = ['application/octet-stream', 'image/png'];
			apiRouteConfig.routes.echo.POST.requestContentHandling = 'CONVERT_TO_BINARY';
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo', {
					headers: {'content-type': 'application/octet-stream', 'result-content-type': 'text/plain'},
					body: 'Hello World',
					method: 'POST'
				});
			}).then(contents => {
				expect(contents.body).toEqual('SGVsbG8gV29ybGQ=');
			}).then(done, done.fail);
		});
		it('sets up the API to convert base64 results to binary', done => {
			apiRouteConfig.binaryMediaTypes = ['application/octet-stream', 'image/png'];
			apiRouteConfig.routes.echo.POST.success = { contentHandling: 'CONVERT_TO_BINARY' };
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo', {
					headers: {'Content-Type': 'text/plain', 'result-encoded': 'true', 'accept': 'image/png', 'result-content-type': 'image/png'},
					body: 'SGVsbG8gV29ybGQ=',
					method: 'POST'
				});
			}).then(contents => {
				expect(contents.body).toEqual('Hello World');
				expect(contents.headers['content-type']).toEqual('image/png');
			}).then(done, done.fail);
		});
		it('does not convert to binary unless the encoding flag is set', done => {
			apiRouteConfig.binaryMediaTypes = ['application/octet-stream', 'image/png'];
			apiRouteConfig.routes.echo.POST.success = { contentHandling: 'CONVERT_TO_BINARY' };
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo', {
					headers: {'Content-Type': 'text/plain', 'accept': 'image/png', 'result-content-type': 'image/png'},
					body: 'SGVsbG8gV29ybGQ=',
					method: 'POST'
				});
			}).then(contents => {
				expect(contents.body).toEqual('SGVsbG8gV29ybGQ=');
				expect(contents.headers['content-type']).toEqual('image/png');
			}).then(done, done.fail);
		});
	});
	describe('custom authorizers', () => {
		let authorizerLambdaName;
		beforeEach(done => {
			const authorizerLambdaDir = path.join(workingdir, 'authorizer');

			shell.mkdir('-p', workingdir);
			shell.mkdir('-p', authorizerLambdaDir);
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
			shell.cp('-r', 'spec/test-projects/echo/*', authorizerLambdaDir);

			apiRouteConfig.corsHandlers = false;
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({name: testRunName});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(() => {
				return create({name: testRunName + 'auth', version: 'original', role: genericTestRole.get(), region: awsRegion, source: authorizerLambdaDir, handler: 'main.handler'});
			}).then(result => {
				authorizerLambdaName = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		afterEach(done => {
			const lambda = new aws.Lambda({region: awsRegion});
			lambda.deleteFunction({FunctionName: authorizerLambdaName}).promise().then(done, done.fail);
		});
		it('assigns authorizers by name', done => {
			const authorizerIds = {};
			let echoResourceId;
			apiRouteConfig.authorizers = {
				first: { lambdaName: authorizerLambdaName, headerName: 'Authorization' },
				second: { lambdaName: authorizerLambdaName, headerName: 'UserId' }
			};
			apiRouteConfig.routes.echo.POST = {customAuthorizer: 'second'};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return apiGateway.getResourcesPromise({
					restApiId: apiId
				});
			}).then(resources => {
				resources.items.forEach(resource => {
					if (resource.path === '/echo') {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(() => {
				return apiGateway.getAuthorizersPromise({
					restApiId: apiId
				});
			}).then(authorizers => {
				authorizerIds[authorizers.items[0].name] = authorizers.items[0].id;
				authorizerIds[authorizers.items[1].name] = authorizers.items[1].id;
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: 'GET',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(methodConfig => {
				expect(methodConfig.authorizationType).toEqual('NONE');
				expect(methodConfig.authorizerId).toBeUndefined();
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: 'POST',
					resourceId: echoResourceId,
					restApiId: apiId
				});
			}).then(methodConfig => {
				expect(methodConfig.authorizationType).toEqual('CUSTOM');
				expect(methodConfig.authorizerId).toEqual(authorizerIds.second);
			}).then(done, done.fail);
		});
	});

	describe('CORS handling', () => {
		beforeEach(done => {
			shell.cp('-r', 'spec/test-projects/api-gw-proxy-headers/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);

		});
		describe('without custom CORS options', () => {
			it('creates OPTIONS handlers for CORS', done => {
				apiRouteConfig.routes.hello = {POST: {}, GET: {}};
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo', {method: 'OPTIONS'});
				}).then(contents => {
					expect(contents.headers['access-control-allow-methods']).toEqual('OPTIONS,GET');
					expect(contents.headers['access-control-allow-headers']).toEqual('Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token');
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
					expect(contents.headers['access-control-allow-credentials']).toEqual('true');
					expect(contents.headers['access-control-max-age']).toBeUndefined();
				}).then(() => {
					return invoke('original/hello', {method: 'OPTIONS'});
				}).then(contents => {
					expect(contents.headers['access-control-allow-methods']).toEqual('OPTIONS,GET,POST');
					expect(contents.headers['access-control-allow-headers']).toEqual('Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token');
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
					expect(contents.headers['access-control-allow-credentials']).toEqual('true');
					expect(contents.headers['access-control-max-age']).toBeUndefined();
				}).then(done, done.fail);
			});
			it('creates a MOCK integration for performance', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => getResourceForPath('/echo'))
				.then(resourceId => {
					return apiGateway.getIntegrationPromise({
						httpMethod: 'OPTIONS',
						resourceId: resourceId,
						restApiId: apiId
					});
				}).then(response => {
					expect(response.type).toEqual('MOCK');
				}).then(done, done.fail);
			});
			it('can create CORS handlers for APIs with param paths -- regression check', done => {
				apiRouteConfig.routes['{owner}'] = {GET: {}};
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo', {method: 'OPTIONS'});
				}).then(contents => {
					expect(contents.headers['access-control-allow-methods']).toEqual('OPTIONS,GET');
					expect(contents.headers['access-control-allow-headers']).toEqual('Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token');
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
					expect(contents.headers['access-control-allow-credentials']).toEqual('true');
					expect(contents.headers['access-control-max-age']).toBeUndefined();
				}).then(done, done.fail);
			});
			it('allows a custom OPTIONS handler to take over execution completely for CORS', done => {
				apiRouteConfig.routes.manual = {POST: {}, OPTIONS: {}};
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => getResourceForPath('/manual'))
				.then(resourceId => {
					return apiGateway.getIntegrationPromise({
						httpMethod: 'OPTIONS',
						resourceId: resourceId,
						restApiId: apiId
					});
				}).then(response => {
					expect(response.type).toEqual('AWS_PROXY');
				}).then(() => {
					return invoke('original/manual', {
						method: 'OPTIONS',
						headers: {'content-type': 'text/plain'},
						body: JSON.stringify({
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Headers': 'X-Custom-Header,X-Api-Key',
							'Access-Control-Allow-Origin': 'custom-origin',
							'Access-Control-Allow-credentials': 'c1-false'
						})
					});
				}).then(contents => {
					expect(contents.headers['access-control-allow-methods']).toEqual('GET,OPTIONS');
					expect(contents.headers['access-control-allow-headers']).toEqual('X-Custom-Header,X-Api-Key');
					expect(contents.headers['access-control-allow-origin']).toEqual('custom-origin');
					expect(contents.headers['access-control-allow-credentials']).toEqual('c1-false');
				}).then(done, done.fail);
			});
		});
		describe('when corsHeaders are set', () => {
			it('uses the headers for OPTIONS handlers', done => {
				apiRouteConfig.corsHeaders = 'X-Custom-Header,X-Api-Key';
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo', {method: 'OPTIONS'});
				}).then(contents => {
					expect(contents.headers['access-control-allow-headers']).toEqual('X-Custom-Header,X-Api-Key');
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
					expect(contents.headers['access-control-allow-credentials']).toEqual('true');
				}).then(done, done.fail);
			});
			it('uses the headers for OPTIONS handlers even when blank string', done => {
				apiRouteConfig.corsHeaders = '';
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => {
					return invoke('original/echo', {method: 'OPTIONS'});
				}).then(contents => {
					expect(contents.headers['access-control-allow-headers']).toBeUndefined();
					expect(contents.headers['access-control-allow-origin']).toEqual('*');
					expect(contents.headers['access-control-allow-credentials']).toEqual('true');
				}).then(done, done.fail);
			});
		});
		describe('when corsHandlers are set to false', () => {
			beforeEach(() => {

				apiRouteConfig.corsHandlers = false;

			});
			it('does not create any OPTIONS integration by default', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => getResourceForPath('/echo'))
				.then(resourceId => {
					return apiGateway.getIntegrationPromise({
						httpMethod: 'OPTIONS',
						resourceId: resourceId,
						restApiId: apiId
					}).then(r => {
						expect(r).toBeUndefined();
						done.fail('OPTIONS resource created');
					}).catch(e => {
						expect(e.code).toEqual('NotFoundException');
					});
				}).then(done, done.fail);
			});
			it('allows the API to set up its own OPTIONS for specific resources', done => {
				apiRouteConfig.routes.manual = {GET: {}, OPTIONS: {}};
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => getResourceForPath('/manual'))
				.then(resourceId => apiGateway.getIntegrationPromise({
					httpMethod: 'OPTIONS',
					resourceId: resourceId,
					restApiId: apiId
				}))
				.then(response => expect(response.type).toEqual('AWS_PROXY'))
				.then(() => {
					return invoke('original/manual', {
						method: 'OPTIONS',
						headers: {'content-type': 'text/plain'},
						body: JSON.stringify({
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Headers': 'X-Custom-Header,X-Api-Key',
							'Access-Control-Allow-Origin': 'custom-origin',
							'Access-Control-Allow-credentials': 'c1-false'
						})
					});
				}).then(contents => {
					expect(contents.headers['access-control-allow-methods']).toEqual('GET,OPTIONS');
					expect(contents.headers['access-control-allow-headers']).toEqual('X-Custom-Header,X-Api-Key');
					expect(contents.headers['access-control-allow-origin']).toEqual('custom-origin');
					expect(contents.headers['access-control-allow-credentials']).toEqual('c1-false');
				}).then(done, done.fail);
			});
		});
		describe('when corsHandlers are set to true', () => {
			beforeEach(() => {
				apiRouteConfig.corsHandlers = true;
			});
			it('routes the OPTIONS handler to Lambda', done => {
				apiRouteConfig.routes.hello = {POST: {}, GET: {}};
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => getResourceForPath('/echo'))
				.then(resourceId => apiGateway.getIntegrationPromise({
					httpMethod: 'OPTIONS',
					resourceId: resourceId,
					restApiId: apiId
				}))
				.then(response => expect(response.type).toEqual('AWS_PROXY'))
				.then(() => {
					return invoke('original/echo', {
						method: 'OPTIONS',
						headers: {'content-type': 'text/plain'},
						body: JSON.stringify({
							'Access-Control-Allow-Methods': 'GET,OPTIONS',
							'Access-Control-Allow-Headers': 'X-Custom-Header,X-Api-Key',
							'Access-Control-Allow-Origin': 'custom-origin',
							'Access-Control-Allow-credentials': 'c1-false'
						})
					});
				}).then(contents => {
					expect(contents.headers['access-control-allow-methods']).toEqual('GET,OPTIONS');
					expect(contents.headers['access-control-allow-headers']).toEqual('X-Custom-Header,X-Api-Key');
					expect(contents.headers['access-control-allow-origin']).toEqual('custom-origin');
					expect(contents.headers['access-control-allow-credentials']).toEqual('c1-false');
				}).then(done, e => {
					console.log(e);
					done.fail();
				});
			});
		});
		describe('when corsHandlers are set to a string', () => {
			beforeEach(() => {
				apiRouteConfig.corsHandlers = 'api.test.com';
			});
			it('creates a MOCK integration for the fixed domain', done => {

				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
				.then(() => getResourceForPath('/echo'))
				.then(resourceId => {
					return apiGateway.getIntegrationPromise({
						httpMethod: 'OPTIONS',
						resourceId: resourceId,
						restApiId: apiId
					});
				}).then(response => {
					expect(response.type).toEqual('MOCK');
				}).then(() => {
					return invoke('original/echo', { method: 'OPTIONS' });
				}).then(contents => {
					expect(contents.headers['access-control-allow-methods']).toEqual('OPTIONS,GET');
					expect(contents.headers['access-control-allow-headers']).toEqual('Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token');
					expect(contents.headers['access-control-allow-origin']).toEqual('api.test.com');
					expect(contents.headers['access-control-allow-credentials']).toEqual('true');
					expect(contents.headers['access-control-max-age']).toBeUndefined();
				}).then(done, done.fail);
			});
		});

		describe('when corsMaxAge is set', () => {
			beforeEach(() => {
				apiRouteConfig.corsMaxAge = 10;
			});
			it('uses the headers for OPTIONS handlers', done => {
				underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
					.then(() => {
						return invoke('original/echo', {method: 'OPTIONS'});
					}).then(contents => {
						expect(contents.headers['access-control-allow-origin']).toEqual('*');
						expect(contents.headers['access-control-allow-credentials']).toEqual('true');
						expect(contents.headers['access-control-max-age']).toEqual('10');
					}).then(done, done.fail);
			});
		});

	});

	describe('when working with an existing api', () => {
		beforeEach(done => {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(() => {
				apiRouteConfig.routes.hello = {POST: {}};
				apiRouteConfig.routes[''] = {GET: {}, PUT: {}};
				apiRouteConfig.routes.sub = {GET: {}, PUT: {}};
				apiRouteConfig.routes['sub/mapped/sub2'] = {GET: {}, PUT: {}};
				apiRouteConfig.corsHandlers = false;
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion);
			}).then(done, done.fail);
		});
		it('removes all previous custom gateway responses', done => {
			apiGateway.putGatewayResponsePromise({
				restApiId: apiId,
				responseType: 'DEFAULT_4XX',
				statusCode: '411'
			})
			.then(() => underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {extra: { GET: {}}}}, awsRegion))
			.then(() => getCustomGatewayResponses())
			.then(result => expect(result).toEqual([]))
			.then(done, done.fail);
		});
		it('adds new custom gateway responses', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 3, routes: {extra: { GET: {}}}, customResponses: {'DEFAULT_4XX': {statusCode: 411}}}, awsRegion)
			.then(() => getCustomGatewayResponses())
			.then(result => expect(result.map(r => r.responseType)).toEqual(['DEFAULT_4XX']))
			.then(done, done.fail);
		});
		it('adds extra paths from the new definition', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {extra: { GET: {}}}}, awsRegion)
			.then(() => {
				return invoke('original/extra');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/extra');
			}).then(done, done.fail);
		});
		it('adds subresources mapped with intermediate paths', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, {version: 2, routes: {'sub/map2/map3': { GET: {}}}}, awsRegion)
			.then(() => {
				return invoke('original/sub/map2/map3');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/sub/map2/map3');
			}).then(done, e => {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
		it('adds extra methods to an existing path', done => {
			apiRouteConfig.routes.echo.POST = {};
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/echo', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/echo');
			}).then(done, done.fail);
		});
		it('replaces root path handlers', done => {
			apiRouteConfig.routes[''] = { POST: {}, GET: {} };
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return invoke('original/', {method: 'POST'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('POST');
				expect(params.requestContext.resourcePath).toEqual('/');
			}).then(() => {
				return invoke('original/', {method: 'GET'});
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/');
			}).then(done, done.fail);
		});
		it('preserves old stage variables', done => {
			apiGateway.createDeploymentPromise({
				restApiId: apiId,
				stageName: 'original',
				variables: {
					lambdaVersion: 'original',
					authKey: 'abs123',
					authBucket: 'bucket123'
				}
			}).then(() => {
				return underTest(newObjects.lambdaFunction, 'original', apiId, {corsHandlers: false, version: 2, routes: {extra: { GET: {}}}}, awsRegion);
			}).then(() => {
				return invoke('original/extra');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'original',
					authKey: 'abs123',
					authBucket: 'bucket123'
				});
			}).then(done, done.fail);
		});
	});
	describe('setting request parameters for caching', () => {
		const testMethodConfig = function (methodConfig, resourcePath, method) {
			let echoResourceId;
			apiRouteConfig.routes = methodConfig;
			return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion)
			.then(() => {
				return apiGateway.getResourcesPromise({
					restApiId: apiId
				});
			}).then(resources => {
				resources.items.forEach(resource => {
					if (resource.path === resourcePath) {
						echoResourceId = resource.id;
					}
				});
				return echoResourceId;
			}).then(() => {
				return apiGateway.getMethodPromise({
					httpMethod: method,
					resourceId: echoResourceId,
					restApiId: apiId
				});
			});
		};
		beforeEach(done => {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);
		});
		it('sets no request parameters if path params are not present', done => {
			testMethodConfig({ '/echo': {GET: {}}}, '/echo', 'GET').then(result => {
				expect(result.requestParameters).toBeFalsy();
				expect(result.methodIntegration.cacheKeyParameters).toEqual([]);
			}).then(done, done.fail);
		});
		it('allows setting request parameters with config', done => {
			testMethodConfig({
				'/echo': {
					GET: {
						requestParameters: {
							querystring: {
								name: true,
								title: false
							},
							header: {
								'x-bz': true
							}
						}
					}
				}
			}, '/echo', 'GET').then(result => {
				expect(result.requestParameters).toEqual({
					'method.request.querystring.name': true,
					'method.request.querystring.title': false,
					'method.request.header.x-bz': true
				});
				expect(result.methodIntegration.cacheKeyParameters.sort()).toEqual(['method.request.querystring.name', 'method.request.querystring.title', 'method.request.header.x-bz'].sort());
			}).then(done, done.fail);
		});
		it('sets request parameters for paths automatically', done => {
			testMethodConfig({
				'/echo/{name}': {
					GET: {}
				}
			}, '/echo/{name}', 'GET').then(result => {
				expect(result.requestParameters).toEqual({
					'method.request.path.name': true
				});
				expect(result.methodIntegration.cacheKeyParameters).toEqual(['method.request.path.name']);
			}).then(done, done.fail);
		});
		it('appends additional parameters to path params', done => {
			testMethodConfig({
				'/echo/{name}': {
					GET: {
						requestParameters: {
							querystring: {
								title: true
							}
						}
					}
				}
			}, '/echo/{name}', 'GET').then(result => {
				expect(result.requestParameters).toEqual({
					'method.request.path.name': true,
					'method.request.querystring.title': true
				});
				expect(result.methodIntegration.cacheKeyParameters.sort()).toEqual(['method.request.path.name', 'method.request.querystring.title'].sort());
			}).then(done, done.fail);
		});
		it('does not sets parameters on options', done => {
			testMethodConfig({
				'/echo/{name}': {
					GET: {
						querystring: {
							title: true
						}
					}
				}
			}, '/{proxy+}', 'OPTIONS').then(result => {
				expect(result.requestParameters).toBeFalsy();
				expect(result.methodIntegration.cacheKeyParameters).toEqual([]);
			}).then(done, done.fail);
		});
	});
	describe('logging', () => {
		let logger;
		beforeEach(done => {
			logger = new ArrayLogger();
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);
		});
		it('logs execution', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger).then(() => {
				expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
					'apigateway.getRestApi',
					'apigateway.setupRequestListeners',
					'apigateway.setAcceptHeader',
					'apigateway.getResources',
					'apigateway.getGatewayResponses',
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
	describe('configuration caching', () => {
		let logger;
		beforeEach(done => {
			logger = new ArrayLogger();
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(() => {
				return apiGateway.createRestApiPromise({
					name: testRunName
				});
			}).then(result => {
				apiId = result.id;
				newObjects.restApi = result.id;
			}).then(done, done.fail);
		});
		it('stores the configuration hash in a stage variable', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash').then(() => {
				return invoke('original/echo');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'original',
					configHash: '-EDMbG0OcNlCZzstFc2jH6rlpI1YDlNYc9YGGxUFuXo='
				});
			}).then(done, done.fail);
		});
		it('runs through the whole deployment if there was no previous stage by this name', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined, 'configHash').then(() => {
				return underTest(newObjects.lambdaFunction, 'latest', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(result => {
				expect(result.cacheReused).toBeFalsy();
				expect(logger.getApiCallLogForService('apigateway', true)).toContain('apigateway.createResource');
				expect(logger.getStageLog(true)).not.toContain('Reusing cached API configuration');
			}).then(done, done.fail);
		});
		it('runs through the whole deployment if there was no config hash in the previous stage with the same name', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined).then(() => {
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(result => {
				expect(result.cacheReused).toBeFalsy();
				expect(logger.getApiCallLogForService('apigateway', true)).toContain('apigateway.createResource');
				expect(logger.getStageLog(true)).not.toContain('Reusing cached API configuration');
			}).then(done, done.fail);
		});
		it('runs through the whole deployment if there was a previous config hash but was different', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined, 'configHash').then(() => {
				apiRouteConfig.routes.echo.POST = {};
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(result => {
				expect(result.cacheReused).toBeFalsy();
				expect(logger.getApiCallLogForService('apigateway', true)).toContain('apigateway.createResource');
				expect(logger.getStageLog()).not.toContain('Reusing cached API configuration');
			}).then(done, done.fail);
		});
		it('skips deleting and creating resources if there was a previous stage with the same name and config hash', done => {
			underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, undefined, 'configHash').then(() => {
				return underTest(newObjects.lambdaFunction, 'original', apiId, apiRouteConfig, awsRegion, logger, 'configHash');
			}).then(result => {
				expect(result.cacheReused).toBeTruthy();
				expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
					'apigateway.getRestApi',
					'apigateway.setupRequestListeners',
					'apigateway.setAcceptHeader',
					'apigateway.getStage'
				]);
				expect(logger.getStageLog(true)).toContain('Reusing cached API configuration');
			}).then(done, done.fail);
		});
	});
});
