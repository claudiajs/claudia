/*global describe, it, expect, require, __dirname, beforeEach, jasmine*/
var path = require('path'),
	underTest = require('../src/tasks/validate-package');
describe('validatePackage', function () {
	'use strict';
	beforeEach(function () {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;
	});
	describe('when the handler is set without api module', function () {
		it('fails if router require fails', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/echo-dependency-problem'), 'main.handler');
			}).toThrow('cannot require ./main after npm install --production. Check your dependencies.');
		});
		it('fails if the main module does not export the handler method', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/echo'), 'main.nonhandler');
			}).toThrow('main.js does not export method nonhandler');
		});
		it('returns package dir if the handler corresponds to the exported method', function () {
			var dir = path.join(__dirname, 'test-projects/echo');
			expect(underTest(dir, 'main.handler')).toEqual(dir);
		});
	});
	describe('when the rest api module is set', function () {

		it('fails if router require fails', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/echo-dependency-problem'), 'main.handler', 'main');
			}).toThrow('cannot require ./main after npm install --production. Check your dependencies.');
		});
		it('fails if the main module does not export the router method', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/echo'), 'main.proxyRouter', 'main');
			}).toThrow('main.js does not export a Claudia API Builder instance');
		});
		it('fails if the main module does not configure any API methods', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/empty-api'), 'main.proxyRouter', 'main');
			}).toThrow('main.js does not configure any API methods');
		});
		it('fails if the api version is not supported', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/old-api'), 'main.proxyRouter', 'main');
			}).toThrow('main.js uses an unsupported API version. Upgrade your claudia installation');
		});
		it('fails if the api version is not supported', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/future-api'), 'main.proxyRouter', 'main');
			}).toThrow('main.js uses an unsupported API version. Upgrade your claudia installation');
		});
		it('returns package dir if the handler corresponds to the exported method', function () {
			var dir = path.join(__dirname, 'test-projects/api-gw-echo');
			expect(underTest(dir, 'main.proxyRouter', 'main')).toEqual(dir);
		});
		it('fails if the headers are specified with defaults as an empty object', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-success-headers-empty'), 'main.proxyRouter', 'main');
			}).toThrow('main.js GET /echo requests custom headers but does not enumerate any headers');
		});
		it('fails if the headers are specified with defaults as an empty object', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-headers-empty'), 'main.proxyRouter', 'main');
			}).toThrow('main.js GET /echo error template requests custom headers but does not enumerate any headers');
		});
		it('fails if the headers are specified with defaults as an empty object', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-headers-no-defaults'), 'main.proxyRouter', 'main');
			}).toThrow('main.js GET /echo error template requests custom headers but does not provide defaults');
		});
		it('fails if a method requests an undefined authorizer', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorizer-validation'), 'undefined_authorizer.proxyRouter', 'undefined_authorizer');
			}).toThrow('undefined_authorizer.js GET /echo requests an undefined custom authorizer customA');
		});
		it('fails if a method requests an authorizer but no authorizers defined', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorizer-validation'), 'no_authorizers.proxyRouter', 'no_authorizers');
			}).toThrow('no_authorizers.js GET /echo requests an undefined custom authorizer customA');
		});
		it('fails if an authorizer is not configured with either lambda name or arn', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorizer-validation'), 'misconfigured_authorizer.proxyRouter', 'misconfigured_authorizer');
			}).toThrow('misconfigured_authorizer.js authorizer first requires either lambdaName or lambdaArn');
		});
		it('fails if an authorizer is configured with both lambda name and arn', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorizer-validation'), 'overconfigured_authorizer.proxyRouter', 'overconfigured_authorizer');
			}).toThrow('overconfigured_authorizer.js authorizer first is ambiguous - both lambdaName or lambdaArn are defined');
		});
		it('fails if an authorizer is configured with version and arn', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorizer-validation'), 'overconfigured_version.proxyRouter', 'overconfigured_version');
			}).toThrow('overconfigured_version.js authorizer first is ambiguous - cannot use lambdaVersion with lambdaArn');
		});
		it('fails if an authorizer version is invalid format', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorizer-validation'), 'misconfigured_version.proxyRouter', 'misconfigured_version');
			}).toThrow('misconfigured_version.js authorizer first lambdaVersion must be either string or true');
		});
		it('fails when an invalid authorization type is specified', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorization'), 'invalid_authorization.proxyRouter', 'invalid_authorization');
			}).toThrow('invalid_authorization.js GET /echo authorization type BOOM is invalid');

		});
		it('fails when authorizer is specified with IAM', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorization'), 'overconfigured_authorization.proxyRouter', 'overconfigured_authorization');
			}).toThrow('overconfigured_authorization.js GET /echo authorization type AWS_IAM is incompatible with custom authorizers');

		});
		it('fails when credentials are specified with CUSTOM', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorization'), 'overconfigured_credentials.proxyRouter', 'overconfigured_credentials');
			}).toThrow('overconfigured_credentials.js GET /echo authorization type CUSTOM is incompatible with invokeWithCredentials');

		});

		it('fails when credentials are invalid', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-authorization'), 'invalid_credentials.proxyRouter', 'invalid_credentials');
			}).toThrow('invalid_credentials.js GET /echo credentials have to be either an ARN or a boolean');

		});

		it('does not fail when the api is well configured', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-validation-kitchen-sink'), 'main.proxyRouter', 'main');
			}).not.toThrow();
		});

	});
});
