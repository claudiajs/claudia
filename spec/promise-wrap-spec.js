/*global describe, it, beforeEach, expect, jasmine, require */
var underTest = require('../src/util/promise-wrap'),
	Promise = require('bluebird');
describe('promiseWrap', function () {
	'use strict';
	var target, resolve, reject, logger;
	beforeEach(function () {
		target = jasmine.createSpyObj('target', ['f1', 'f2']);
		resolve = jasmine.createSpy('resolve');
		reject = jasmine.createSpy('reject');
		logger = jasmine.createSpy('logger');
	});
	describe('promise workflow', function () {
		var result;
		beforeEach(function () {
			result = underTest(target, {log: logger, logName: 'Service1'});
		});
		it('wraps all the methods of a target object', function () {
			expect(typeof result.f1Promise).toEqual('function');
			expect(typeof result.f2Promise).toEqual('function');
		});
		it('passes all the arguments through the proxy', function () {
			result.f1Promise('a', 'b', {c: true});
			expect(target.f1).toHaveBeenCalled();
			expect(target.f1.calls.mostRecent().args).toEqual(['a', 'b', {c: true}, jasmine.any(Function)]);
		});
		it('does not resolve the promise before the callback gets invoked', function (done) {
			result.f1Promise('a', 'b', {c: true}).then(resolve, reject);
			Promise.resolve().then(function () {
				expect(resolve).not.toHaveBeenCalled();
				expect(reject).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('resolves the promise if the underlying callback completes', function (done) {
			result.f1Promise('a', 'b', {c: true}).then(function (result) {
				expect(result).toEqual({is: 'yes'});
			}).then(done, done.fail);
			target.f1.calls.mostRecent().args[3](null, {is: 'yes'});
		});
		it('rejects the promise if the underlying callback reports an error', function (done) {
			result.f1Promise('a', 'b', {c: true}).then(done.fail, function (err) {
				expect(err).toEqual({is: 'no'});
			}).then(done);
			target.f1.calls.mostRecent().args[3]({is: 'no'});
		});
	});
	describe('call reporting', function () {
		it('logs the start of each call to an optional log', function () {
			var result = underTest(target, {log: logger, logName: 'Service1'});
			result.f1Promise('a', 'b', {c: true});
			expect(logger).toHaveBeenCalledWith('Service1.f1', ['a', 'b', {c: true}]);
		});
		it('works even if log is not defined', function () {
			var result = underTest(target, {log: logger, logName: 'Service1'});
			result.f1Promise('a', 'b', {c: true});
			expect(target.f1).toHaveBeenCalled();
		});
		it('works when the logName is not provided', function () {
			var result = underTest(target, {log: logger});
			result.f1Promise('a', 'b', {c: true});
			expect(logger).toHaveBeenCalledWith('f1', ['a', 'b', {c: true}]);
		});
	});
	it('supports an optional suffix for function wrapper names', function () {
		var result = underTest(target, {suffix: 'Async'});
		expect(typeof result.f1Async).toEqual('function');
		expect(result.f1Promise).toBeUndefined();
	});
});
