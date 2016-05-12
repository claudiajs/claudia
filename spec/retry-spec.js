/* global require, describe, it, expect, beforeEach, jasmine */
var retry = require('../src/util/retry'),
	Promise = require('bluebird');
describe('retry', function () {
	'use strict';
	var promiseGenerator, delay, maxTimes, onRetry, promises, resolve, reject,
		buildPromise = function (name) {
			if (!promises) {
				promises = {};
			}
			promises[name] = {};
			promises[name].promise = new Promise(function (resolve, reject) {
				promises[name].resolve = resolve;
				promises[name].reject = reject;
			});
			return promises[name].promise;
		},
		dontRetry = function () {
			return false;
		},
		retryPing = function (err) {
			return err === 'ping';
		};
	beforeEach(function () {
		var sequence = ['a', 'b', 'c', 'd'].map(buildPromise);
		promiseGenerator = function () {
			return sequence.shift();
		};
		delay = 10;
		maxTimes = 5;
		onRetry = jasmine.createSpy('onRetry');
		resolve = jasmine.createSpy('resolve');
		reject = jasmine.createSpy('reject');
	});
	it('does not resolve or reject until the underlying promise resolves', function (done) {
		retry(promiseGenerator, delay, maxTimes, false, onRetry).then(resolve, reject);
		Promise.resolve().then(function () {
			expect(resolve).not.toHaveBeenCalled();
			expect(reject).not.toHaveBeenCalled();
			expect(onRetry).not.toHaveBeenCalled();
		}).then(done, done.fail);
	});
	it('resolves as soon as the underlying promise resolves', function (done) {
		retry(promiseGenerator, delay, maxTimes, false, onRetry).then(function (res) {
			expect(res).toEqual('result');
			expect(onRetry).not.toHaveBeenCalled();
		}).then(done, done.fail);
		promises.a.resolve('result');
	});
	it('rejects as soon as the underlying promise resolves with a non retriable error', function (done) {
		retry(promiseGenerator, delay, maxTimes, dontRetry, onRetry).then(done.fail, function (err) {
			expect(err).toEqual('result');
			expect(onRetry).not.toHaveBeenCalled();
		}).then(done);
		promises.a.reject('result');
	});
	it('retries when the predicate matches the error', function (done) {
		retry(promiseGenerator, delay, maxTimes, retryPing, onRetry).then(function (result) {
			expect(result).toEqual('good');
			expect(onRetry).toHaveBeenCalled();
		}).then(done, done.fail);
		promises.a.reject('ping');
		promises.b.resolve('good');
	});
	it('does not retry if the predicate does not match the error', function (done) {
		retry(promiseGenerator, delay, maxTimes, retryPing, onRetry).then(done.fail, function (err) {
			expect(err).toEqual('pong');
			expect(onRetry).not.toHaveBeenCalled();
		}).then(done);
		promises.a.reject('pong');
		promises.b.resolve('good');

	});
	it('retries several times if errors match', function (done) {
		retry(promiseGenerator, delay, maxTimes, retryPing, onRetry).then(function (result) {
			expect(result).toEqual('good');
			expect(onRetry.calls.count()).toEqual(2);
		}).then(done, done.fail);
		promises.a.promise.catch(function () {
			Promise.delay(1).then(function () {
				promises.b.reject('ping');
			});
		});
		promises.b.promise.catch(function () {
			Promise.delay(1).then(function () {
				promises.c.resolve('good');
			});
		});
		promises.a.reject('ping');
	});

	it('does not retry over the retry limit even when the predicate matches', function (done) {
		onRetry.and.callFake(function () {
			promises.b.reject('ping');
		});
		retry(promiseGenerator, delay, 2, retryPing, onRetry).then(done.fail, function (err) {
			expect(err).toEqual('ping');
			expect(onRetry).toHaveBeenCalled();
		}).then(done);
		promises.a.promise.catch(function () {
			Promise.delay(1).then(function () {
				promises.b.reject('ping');
			});
		});
		promises.b.promise.catch(function () {
			Promise.delay(1).then(function () {
				promises.c.resolve('good');
			});
		});
		promises.a.reject('ping');
	});
});
