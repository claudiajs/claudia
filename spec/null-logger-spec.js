/*global describe, it, expect, beforeEach */
const NullLogger = require('../src/util/null-logger');
describe('NullLogger', () => {
	'use strict';
	let underTest;
	beforeEach(() => {
		underTest = new NullLogger();
	});
	it('has the API methods for logging', () => {
		expect(typeof underTest.logStage).toEqual('function');
		expect(typeof underTest.logApiCall).toEqual('function');
	});
});
