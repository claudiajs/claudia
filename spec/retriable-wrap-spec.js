/* global require, describe, it, expect, beforeEach, jasmine */
var underTest = require('../src/util/retriable-wrap'),
	Promise = require('bluebird');
describe('retriableWrap', function () {
	'use strict';
	var source,
		firstSpy,
		secondSpy,
		thirdSpy,
		promises,
		buildPromise = function (name) {
			promises[name] = {};
			promises[name].promise = new Promise(function (resolve, reject) {
				promises[name].resolve = resolve;
				promises[name].reject = reject;
			});
			return promises[name].promise;
		},
		wrapped,
		onRetry;
	beforeEach(function () {
		promises = {};
		firstSpy = jasmine.createSpy('first').and.returnValue(buildPromise('first'));
		secondSpy = jasmine.createSpy('second').and.returnValue(buildPromise('second'));
		onRetry = jasmine.createSpy('onRetry');
		thirdSpy = jasmine.createSpy('third').and.returnValue(3);
		source = {firstAsync: firstSpy, secondAsync: secondSpy, thirdSync: thirdSpy, thirdAsync: 5};
		wrapped = underTest(source, onRetry, /Async$/);
	});
	it('matches the Promise$ pattern by default', function () {
		source = {firstPromise: firstSpy, secondPromise: secondSpy, thirdSync: thirdSpy, thirdPromise: 5};
		wrapped = underTest(source, onRetry);
		expect(wrapped.firstPromise).not.toEqual(firstSpy);
		expect(wrapped.secondPromise).not.toEqual(secondSpy);
		expect(wrapped.thirdSync).toEqual(thirdSpy);
	});
	it('wraps all methods matching the pattern', function () {
		expect(wrapped.firstAsync).not.toEqual(firstSpy);
		expect(wrapped.secondAsync).not.toEqual(secondSpy);
	});
	it('skips matching properties that are not functions', function () {
		expect(wrapped.thirdAsync).toEqual(5);
	});
	it('does not touch any methods not matching the pattern', function () {
		expect(wrapped.thirdSync).toEqual(thirdSpy);
	});
	it('proxies calls to promise methods', function () {
		wrapped.firstAsync('124');
		expect(firstSpy).toHaveBeenCalledWith('124');
	});
	it('proxies the right call to the right promise method', function () {
		wrapped.secondAsync('555');
		expect(secondSpy).toHaveBeenCalledWith('555');
		expect(firstSpy).not.toHaveBeenCalled();
	});
	it('does not resolve or reject until the underlying promise resolves', function (done) {
		var resolve = jasmine.createSpy('resolve'), reject = jasmine.createSpy('reject');
		wrapped.firstAsync('124').then(resolve, reject);
		Promise.resolve().then(function () {
			expect(resolve).not.toHaveBeenCalled();
			expect(reject).not.toHaveBeenCalled();
		}).then(done, done.fail);
	});
	it('resolves as soon as the underlying promise resolves', function (done) {
		wrapped.firstAsync('124').then(function (res) {
			expect(res).toEqual('result');
			expect(onRetry).not.toHaveBeenCalled();
		}).then(done, done.fail);
		promises.first.resolve('result');
	});
	it('rejects as soon as the underlying promise resolves with a non retriable error', function (done) {
		wrapped.firstAsync('124').then(done.fail, function (err) {
			expect(err).toEqual('result');
			expect(onRetry).not.toHaveBeenCalled();
		}).then(done);
		promises.first.reject('result');
	});
	it('retries TooManyRequestsException', function (done) {
		var sequence = [buildPromise('a'), buildPromise('b')],
			source = { retryAsync: function () {
				return sequence.shift();
			}},
			wrapped = underTest(source, onRetry, /Async$/, 10, 5);
		wrapped.retryAsync().then(function (result) {
			expect(onRetry).toHaveBeenCalled();
			expect(result).toEqual('good');
		}).then(done, done.fail);
		promises.a.reject({code: 'TooManyRequestsException'});
		promises.b.resolve('good');
	});
	it('fails TooManyRequestsException if over the retry limit', function (done) {
		var sequence = [buildPromise('a'), buildPromise('b'), buildPromise('c')],
			source = { retryAsync: function () {
				return sequence.shift();
			}},
			wrapped = underTest(source, onRetry, /Async$/, 10, 1);
		wrapped.retryAsync().then(done.fail, function (err) {
			expect(onRetry).not.toHaveBeenCalled();
			expect(err).toEqual({code: 'TooManyRequestsException'});
		}).then(done);
		promises.a.reject({code: 'TooManyRequestsException'});
		promises.b.resolve('good');
	});

});
