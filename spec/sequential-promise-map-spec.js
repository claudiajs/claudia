/*global describe, it, expect, require, beforeEach, Promise,setTimeout */
var sequentialPromiseMap = require('../src/util/sequential-promise-map');
describe('sequentialPromiseMap', function () {
	'use strict';
	var promises,
		waitFor = function (index) {
			return new Promise(function (resolve) {
				var poll = function () {
					if (promises[index]) {
						resolve({ promise: promises[index] });
					} else {
						setTimeout(poll, 50);
					}
				};
				poll();
			});
		},
		generator = function (arg) {
			var next = {}, res, rej;
			next = new Promise(function (resolve, reject) {
				res = resolve;
				rej = reject;
			});
			next.reject = rej;
			next.resolve = res;
			next.arg = arg;
			promises.push(next);
			return next;
		};
	beforeEach(function () {
		promises = [];
	});
	it('resolves immediately if no arguments', function (done) {
		sequentialPromiseMap([], generator).then(function (result) {
			expect(promises.length).toEqual(0);
			expect(result).toEqual([]);
		}).then(done, done.fail);
	});
	it('executes a single promise mapping', function (done) {
		sequentialPromiseMap(['a'], generator).then(function (result) {
			expect(promises.length).toEqual(1);
			expect(result).toEqual(['eee']);
			expect(promises[0].arg).toEqual('a');
		}).then(done, done.fail);
		waitFor(0).then(function (promiseContainer) {
			expect(promiseContainer.promise.arg).toEqual('a');
			promiseContainer.promise.resolve('eee');
		}).catch(done.fail);
	});
	it('does not resolve until all promises resolve', function (done) {
		sequentialPromiseMap(['a', 'b', 'c'], generator).then(done.fail, done.fail);
		waitFor(0).then(function (promiseContainer) {
			promiseContainer.promise.resolve('eee');
		});
		waitFor(1).then(function () {
			expect(promises.length).toEqual(2);
		}).then(done);
	});
	it('resolves after all the promises resolve', function (done) {
		sequentialPromiseMap(['a', 'b'], generator).then(function (result) {
			expect(result).toEqual(['aaa', 'bbb']);
		}).then(done, done.fail);
		waitFor(0).then(function (promiseContainer) {
			promiseContainer.promise.resolve('aaa');
		});
		waitFor(1).then(function (promiseContainer) {
			promiseContainer.promise.resolve('bbb');
		});

	});
	it('does not execute subsequent promises after a failure', function (done) {
		sequentialPromiseMap(['a', 'b'], generator).then(done.fail, function () {
			expect(promises.length).toEqual(1);
			done();
		});
		waitFor(0).then(function (promiseContainer) {
			promiseContainer.promise.reject('aaa');
		});
	});
	it('rejects with the error of the first rejected promise', function (done) {
		sequentialPromiseMap(['a', 'b', 'c'], generator).then(done.fail, function (err) {
			expect(err).toEqual('boom');
			done();
		});
		waitFor(0).then(function (promiseContainer) {
			promiseContainer.promise.resolve('aaa');
		});
		waitFor(1).then(function (promiseContainer) {
			promiseContainer.promise.reject('boom');
		});
	});
});
