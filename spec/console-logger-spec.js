/*global describe, it, require, expect, beforeEach, jasmine */
var ConsoleLogger = require('../src/util/console-logger');
describe('ConsoleLogger', function () {
	'use strict';
	var underTest, fakeWritable;
	beforeEach(function () {
		fakeWritable = jasmine.createSpyObj('stderr', ['write']);
		underTest = new ConsoleLogger('[END]', fakeWritable);
	});
	it('has the API methods for logging', function () {
		expect(typeof underTest.logStage).toEqual('function');
		expect(typeof underTest.logApiCall).toEqual('function');
	});
	describe('logStage', function () {
		it('logs stage and back to left edge', function () {
			underTest.logStage('stage 1');
			expect(fakeWritable.write).toHaveBeenCalledWith('stage 1[END]');
		});
	});
	describe('logApiCall', function () {
		it('logs just the api call if the stage is not defined', function () {
			underTest.logApiCall('svc1.api1');
			expect(fakeWritable.write).toHaveBeenCalledWith('svc1.api1[END]');
		});
		it('logs the stage and the api call if the stage is defined', function () {
			underTest.logStage('stage1');
			fakeWritable.write.calls.reset();
			underTest.logApiCall('svc1.api1');
			expect(fakeWritable.write).toHaveBeenCalledWith('stage1\tsvc1.api1[END]');
		});
		it('ignores arguments that are not hash objects', function () {
			underTest.logApiCall('svc1.api1', 12345);
			expect(fakeWritable.write).toHaveBeenCalledWith('svc1.api1[END]');
		});
		it('ignores hash arguments that do not end with ID or Name', function () {
			underTest.logApiCall('svc1.api1', {a: 'b'});
			expect(fakeWritable.write).toHaveBeenCalledWith('svc1.api1[END]');
		});
		it('logs xxxName arguments', function () {
			underTest.logApiCall('svc1.api1', {a: 'b', FunctionName: 'Fun1'});
			expect(fakeWritable.write).toHaveBeenCalledWith('svc1.api1\tFunctionName=Fun1[END]');
		});
		it('logs xxxId arguments', function () {
			underTest.logApiCall('svc1.api1', {a: 'b', RestApiId: 'Api1'});
			expect(fakeWritable.write).toHaveBeenCalledWith('svc1.api1\tRestApiId=Api1[END]');
		});
		it('logs pathXXX arguments', function () {
			underTest.logApiCall('svc1.api1', {a: 'b', pathPart: '/XXX'});
			expect(fakeWritable.write).toHaveBeenCalledWith('svc1.api1\tpathPart=/XXX[END]');
		});
		it('logs multiple args matching', function () {
			underTest.logApiCall('svc1.api1', {a: 'b', FunctionName: 'Fun1', RestApiId: 'YYY'});
			expect(fakeWritable.write).toHaveBeenCalledWith('svc1.api1\tFunctionName=Fun1\tRestApiId=YYY[END]');
		});
	});
});

