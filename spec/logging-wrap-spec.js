/*global describe, it, beforeEach, expect, jasmine, require */
var underTest = require('../src/util/logging-wrap'),
	aws = require('aws-sdk');
describe('loggingWrap', function () {
	'use strict';
	var target, resolve, reject, logger, originalMethods;
	beforeEach(function () {
		target = jasmine.createSpyObj('target', ['f1', 'f2']);
		originalMethods = {};
		Object.keys(target).forEach(function (key) {
			originalMethods[key] = target[key];
		});
		resolve = jasmine.createSpy('resolve');
		reject = jasmine.createSpy('reject');
		logger = jasmine.createSpy('logger');
	});
	describe('call reporting', function () {
		it('logs the start of each call to a log with a logName prefix', function () {
			var result = underTest(target, {log: logger, logName: 'Service1'});
			result.f1('a', 'b', {c: true});
			expect(logger).toHaveBeenCalledWith('Service1.f1', ['a', 'b', {c: true}]);
		});
		it('proxies calls to underlying functions', function () {
			var result = underTest(target, {log: logger, logName: 'Service1'});
			result.f1('a', 'b', {c: true});
			expect(originalMethods.f1).toHaveBeenCalledWith('a', 'b', {c: true});
		});
		it('does not explode when options are not provided', function () {
			var result = underTest(target);
			result.f1('a', 'b', {c: true});
			expect(originalMethods.f1).toHaveBeenCalled();
		});
		it('does not explode when log is not provided', function () {
			var result = underTest(target, {});
			result.f1('a', 'b', {c: true});
			expect(originalMethods.f1).toHaveBeenCalled();
		});
		it('uses blank logname if it is not provided', function () {
			var result = underTest(target, {log: logger});
			result.f1('a', 'b', {c: true});
			expect(logger).toHaveBeenCalledWith('f1', ['a', 'b', {c: true}]);
		});
	});
	it('wraps API objects', function (done) {
		var sts = underTest(new aws.STS(), {log: logger, logName: 'sts'});
		sts.getCallerIdentity().promise().then(function (callerIdentity) {
			expect(callerIdentity.Account).not.toBeUndefined();
			expect(logger).toHaveBeenCalledWith('sts.getCallerIdentity', []);
		}).then(done, done.fail);
	});
});
