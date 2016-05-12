/*global describe, it, require, expect, beforeEach */
var ArrayLogger = require('../src/util/array-logger');
describe('ArrayLogger', function () {
	'use strict';
	var underTest;
	beforeEach(function () {
		underTest = new ArrayLogger();
	});
	it('has the API methods for logging', function () {
		expect(typeof underTest.logStage).toEqual('function');
		expect(typeof underTest.logApiCall).toEqual('function');
	});
	it('logs calls to stages', function () {
		underTest.logStage('first');
		underTest.logStage('second');
		underTest.logStage('first');
		expect(underTest.getStageLog()).toEqual(['first', 'second', 'first']);
	});
	it('can return unique stage log calls', function () {
		underTest.logStage('first');
		underTest.logStage('second');
		underTest.logStage('first');
		expect(underTest.getStageLog(true)).toEqual(['first', 'second']);
	});
	it('logs calls to APIs', function () {
		underTest.logApiCall('method1', 'arg1');
		underTest.logApiCall('method2', 'arg2');
		underTest.logApiCall('method1', 'arg1');
		expect(underTest.getApiCallLog()).toEqual(['method1', 'method2', 'method1']);
	});
	it('can return unique API log calls', function () {
		underTest.logApiCall('method1', 'arg1');
		underTest.logApiCall('method2', 'arg2');
		underTest.logApiCall('method1', 'arg2');
		expect(underTest.getApiCallLog(true)).toEqual(['method1', 'method2']);
	});
	it('can filter API calls by service', function () {
		underTest.logApiCall('Api1.method1', 'arg1');
		underTest.logApiCall('Api1.method2', 'arg2');
		underTest.logApiCall('Api2.method3', 'arg2');
		underTest.logApiCall('Api1.method1', 'arg2');
		expect(underTest.getApiCallLogForService('Api1')).toEqual(['Api1.method1', 'Api1.method2', 'Api1.method1']);
	});
	it('can return unique API calls for service', function () {
		underTest.logApiCall('Api1.method1', 'arg1');
		underTest.logApiCall('Api1.method2', 'arg2');
		underTest.logApiCall('Api2.method3', 'arg2');
		underTest.logApiCall('Api1.method1', 'arg2');
		expect(underTest.getApiCallLogForService('Api1', true)).toEqual(['Api1.method1', 'Api1.method2']);
	});
	it('can return a combined log', function () {
		underTest.logStage('creating stuff');
		underTest.logApiCall('Api1.method1', 'arg1');
		underTest.logStage('creating stuff');
		underTest.logStage('deleting stuff');
		underTest.logApiCall('Api1.method1', 'arg1');
		expect(underTest.getCombinedLog()).toEqual([
			['stage', 'creating stuff'],
			['call', 'Api1.method1', 'arg1'],
			['stage', 'creating stuff'],
			['stage', 'deleting stuff'],
			['call', 'Api1.method1', 'arg1']
		]);
	});
});
