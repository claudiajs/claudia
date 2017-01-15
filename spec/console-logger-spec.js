/*global describe, it, expect, beforeEach, jasmine */
const ConsoleLogger = require('../src/util/console-logger');
describe('ConsoleLogger', () => {
	'use strict';
	let underTest, fakeConsole;
	beforeEach(() => {
		fakeConsole = jasmine.createSpyObj('console', ['log']);
		underTest = new ConsoleLogger('[START]', fakeConsole);
	});
	it('has the API methods for logging', () => {
		expect(typeof underTest.logStage).toEqual('function');
		expect(typeof underTest.logApiCall).toEqual('function');
	});
	describe('logStage', () => {
		it('logs first message without the start marker', () => {
			underTest.logStage('stage 1');
			expect(fakeConsole.log).toHaveBeenCalledWith('stage 1');
		});
		it('logs second message with the start marker', () => {
			underTest.logStage('stage 1');
			fakeConsole.log.calls.reset();
			underTest.logStage('stage 2');
			expect(fakeConsole.log).toHaveBeenCalledWith('[START]stage 2');
		});
	});
	describe('logApiCall', () => {
		it('logs the first call without the start marker', () => {
			underTest.logApiCall('svc1.api1');
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1');
		});
		it('logs the second call with the start marker', () => {
			underTest.logApiCall('svc1.api1');
			fakeConsole.log.calls.reset();
			underTest.logApiCall('svc2.api2');
			expect(fakeConsole.log).toHaveBeenCalledWith('[START]svc2.api2');
		});
		it('logs the stage and the api call if the stage is defined', () => {
			underTest.logStage('stage1');
			fakeConsole.log.calls.reset();
			underTest.logApiCall('svc1.api1');
			expect(fakeConsole.log).toHaveBeenCalledWith('[START]stage1\tsvc1.api1');
		});
		it('ignores arguments that are not arrays', () => {
			underTest.logApiCall('svc1.api1', 12345);
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1');
		});
		it('ignores arguments that are empty arrays', () => {
			underTest.logApiCall('svc1.api1', []);
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1');
		});
		it('ignores hash arguments that do not end with ID or Name', () => {
			underTest.logApiCall('svc1.api1', [{ a: 'b' }]);
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1');
		});
		it('logs xxxName arguments', () => {
			underTest.logApiCall('svc1.api1', [{ a: 'b', FunctionName: 'Fun1' }]);
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1\tFunctionName=Fun1');
		});
		it('logs xxxId arguments', () => {
			underTest.logApiCall('svc1.api1', [{ a: 'b', RestApiId: 'Api1' }]);
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1\tRestApiId=Api1');
		});
		it('logs pathXXX arguments', () => {
			underTest.logApiCall('svc1.api1', [{ a: 'b', pathPart: '/XXX' }]);
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1\tpathPart=/XXX');
		});
		it('logs multiple args matching', () => {
			underTest.logApiCall('svc1.api1', [{ a: 'b', FunctionName: 'Fun1', RestApiId: 'YYY' }]);
			expect(fakeConsole.log).toHaveBeenCalledWith('svc1.api1\tFunctionName=Fun1\tRestApiId=YYY');
		});

	});
});
