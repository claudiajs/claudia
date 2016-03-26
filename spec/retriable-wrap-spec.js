/* global require, describe, it, expect, beforeEach, jasmine */
var underTest = require('../src/util/wrap'),
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
		wrapped;
	beforeEach(function () {
		promises = {};
		firstSpy = jasmine.createSpy('first').and.returnValue(buildPromise('first'));
		secondSpy = jasmine.createSpy('second').and.returnValue(buildPromise('second'));
		thirdSpy = jasmine.createSpy('third').and.returnValue(3);
		source = {firstAsync: firstSpy, secondAsync: secondSpy, thirdSync: thirdSpy, thirdAsync: 5};
		wrapped = underTest('test123', source);
	});
	it('wraps all xxxAsync methods', function () {
		expect(wrapped.firstAsync).not.toEqual(firstSpy);
		expect(wrapped.secondAsync).not.toEqual(secondSpy);
	});
	it('skips xxxAsync properties that are not functions', function () {
		expect(wrapped.thirdAsync).toEqual(5);
	});
	it('does not touch any non xxxAsync methods', function () {
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
		}).then(done, done.fail);
		promises.first.resolve('result');
	});
	it('rejects as soon as the underlying promise resolves with a non retriable error', function (done) {
		wrapped.firstAsync('124').then(done.fail, function (err) {
			expect(err).toEqual('result');
		}).then(done);
		promises.first.reject('result');
	});
	it('retries TooManyRequestsException', function (done) {
		var sequence = [buildPromise('a'), buildPromise('b')],
			source = { retryAsync: function () {
				return sequence.shift();
			}},
			wrapped = underTest('tx', source, false, 10, 5);
		wrapped.retryAsync().then(function (result) {
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
			wrapped = underTest('tx', source, false, 10, 1);
		wrapped.retryAsync().then(done.fail, function (err) {
			expect(err).toEqual({code: 'TooManyRequestsException'});
		}).then(done);
		promises.a.reject({code: 'TooManyRequestsException'});
		promises.b.reject({code: 'TooManyRequestsException'});
		promises.c.resolve('good');
	});

});
