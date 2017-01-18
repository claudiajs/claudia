/*global describe, it, expect, require, beforeEach, Promise,setTimeout */
const sequentialPromiseMap = require('../src/util/sequential-promise-map');
describe('sequentialPromiseMap', () => {
	'use strict';
	let promises;
	const waitFor = function (index) {
			return new Promise(resolve => {
				const poll = function () {
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
			let next = {}, res, rej;
			next = new Promise((resolve, reject) => {
				res = resolve;
				rej = reject;
			});
			next.reject = rej;
			next.resolve = res;
			next.arg = arg;
			promises.push(next);
			return next;
		};
	beforeEach(() => {
		promises = [];
	});
	it('resolves immediately if no arguments', done => {
		sequentialPromiseMap([], generator).then(result => {
			expect(promises.length).toEqual(0);
			expect(result).toEqual([]);
		}).then(done, done.fail);
	});
	it('executes a single promise mapping', done => {
		sequentialPromiseMap(['a'], generator).then(result => {
			expect(promises.length).toEqual(1);
			expect(result).toEqual(['eee']);
			expect(promises[0].arg).toEqual('a');
		}).then(done, done.fail);
		waitFor(0).then(promiseContainer => {
			expect(promiseContainer.promise.arg).toEqual('a');
			promiseContainer.promise.resolve('eee');
		}).catch(done.fail);
	});
	it('does not resolve until all promises resolve', done => {
		sequentialPromiseMap(['a', 'b', 'c'], generator).then(done.fail, done.fail);
		waitFor(0).then(promiseContainer => promiseContainer.promise.resolve('eee'));
		waitFor(1).then(() => expect(promises.length).toEqual(2)).then(done);
	});
	it('resolves after all the promises resolve', done => {
		sequentialPromiseMap(['a', 'b'], generator)
			.then(result => expect(result).toEqual(['aaa', 'bbb']))
			.then(done, done.fail);
		waitFor(0).then(promiseContainer => promiseContainer.promise.resolve('aaa'));
		waitFor(1).then(promiseContainer => promiseContainer.promise.resolve('bbb'));
	});
	it('does not modify the original array', done => {
		const originalArray = ['a', 'b'];
		sequentialPromiseMap(originalArray, generator)
			.then(() => expect(originalArray).toEqual(['a', 'b']))
			.then(done, done.fail);
		waitFor(0).then(promiseContainer => promiseContainer.promise.resolve('aaa'));
		waitFor(1).then(promiseContainer => promiseContainer.promise.resolve('bbb'));
	});
	it('does not execute subsequent promises after a failure', done => {
		sequentialPromiseMap(['a', 'b'], generator).then(done.fail, () => {
			expect(promises.length).toEqual(1);
			done();
		});
		waitFor(0).then(promiseContainer => promiseContainer.promise.reject('aaa'));
	});
	it('rejects with the error of the first rejected promise', done => {
		sequentialPromiseMap(['a', 'b', 'c'], generator)
		.then(done.fail, err => {
			expect(err).toEqual('boom');
			done();
		});
		waitFor(0).then(promiseContainer => promiseContainer.promise.resolve('aaa'));
		waitFor(1).then(promiseContainer => promiseContainer.promise.reject('boom'));
	});
});
