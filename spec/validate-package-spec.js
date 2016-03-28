/*global describe, it, expect, require, __dirname*/
var path = require('path'),
	underTest = require('../src/tasks/validate-package');
describe('validatePackage', function () {
	'use strict';
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
				underTest(path.join(__dirname, 'test-projects/echo'), 'main.router', 'main');
			}).toThrow('main.js does not export a Claudia API Builder instance');
		});
		it('fails if the main module does not configure any API methods', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/empty-api'), 'main.router', 'main');
			}).toThrow('main.js does not configure any API methods');
		});
		it('fails if the api version is not supported', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/future-api'), 'main.router', 'main');
			}).toThrow('main.js uses an unsupported API version. Upgrade your claudia installation');
		});
		it('returns package dir if the handler corresponds to the exported method', function () {
			var dir = path.join(__dirname, 'test-projects/api-gw-echo');
			expect(underTest(dir, 'main.router', 'main')).toEqual(dir);
		});
		it('fails if the headers are specified with defaults as an empty object', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-success-headers-empty'), 'main.router', 'main');
			}).toThrow('main.js GET /echo requests custom headers but does not enumerate any headers');
		});
		it('fails if the headers are specified with defaults as an empty object', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-headers-empty'), 'main.router', 'main');
			}).toThrow('main.js GET /echo error template requests custom headers but does not enumerate any headers');
		});
		it('fails if the headers are specified with defaults as an empty object', function () {
			expect(function () {
				underTest(path.join(__dirname, 'test-projects/api-gw-error-headers-no-defaults'), 'main.router', 'main');
			}).toThrow('main.js GET /echo error template requests custom headers but does not provide defaults');
		});

	});
});
