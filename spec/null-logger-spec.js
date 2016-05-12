/*global describe, it, require, expect, beforeEach */
var NullLogger = require('../src/util/null-logger');
describe('NullLogger', function () {
	'use strict';
	var underTest;
	beforeEach(function () {
		underTest = new NullLogger();
	});
	it('has the API methods for logging', function () {
		expect(typeof underTest.logStage).toEqual('function');
		expect(typeof underTest.logApiCall).toEqual('function');
	});
});

