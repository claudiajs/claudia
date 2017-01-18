/* global describe, it, expect, beforeEach, jasmine */
const underTest = require('../src/util/retriable-wrap'),
	aws = require('aws-sdk');
describe('retriableWrap', () => {
	'use strict';
	let source,
		requestSpy,
		promiseSpy,
		promises,
		wrapped,
		requestMock,
		functionSpy,
		onRetry;
	const buildPromise = function (name) {
		promises[name] = {};
		promises[name].promise = new Promise((resolve, reject) => {
			promises[name].resolve = resolve;
			promises[name].reject = reject;
		});
		return promises[name].promise;
	};
	beforeEach(() => {
		promises = {};
		requestMock = jasmine.createSpyObj('requestMock', ['promise']);
		requestMock.promise.and.returnValue(buildPromise('first'));
		requestSpy = jasmine.createSpy('first').and.returnValue(requestMock);
		functionSpy = jasmine.createSpy('third');
		promiseSpy = jasmine.createSpy('second').and.returnValue(buildPromise('second'));

		onRetry = jasmine.createSpy('onRetry');
		source = {firstMethod: requestSpy, secondMethod: promiseSpy, thirdField: 5, fourthFunction: functionSpy};

		wrapped = underTest(source, onRetry);
	});
	it('wraps all methods matching the pattern', () => {
		expect(typeof wrapped.firstMethodPromise).toBe('function');
		expect(typeof wrapped.secondMethodPromise).toBe('function');
		expect(wrapped.firstMethodPromise).not.toEqual(requestSpy);
		expect(wrapped.secondMethodPromise).not.toEqual(promiseSpy);
	});
	it('skips matching properties that are not functions', () => {
		expect(wrapped.thirdField).toEqual(5);
		expect(wrapped.thirdFieldPromise).toBeUndefined();
	});
	it('proxies calls to request methods', done => {
		requestSpy.and.callFake((number, object) => {
			expect(number).toEqual(124);
			expect(object).toEqual({a: 123});
			done();
		});
		wrapped.firstMethodPromise(124, {a: 123});
	});
	it('proxies calls to promise methods', done => {
		promiseSpy.and.callFake((number, object) => {
			expect(number).toEqual(124);
			expect(object).toEqual({a: 123});
			expect(functionSpy).not.toHaveBeenCalled();
			expect(requestSpy).not.toHaveBeenCalled();
			done();
		});
		wrapped.secondMethodPromise(124, {a: 123});
	});
	it('proxies calls to functions', done => {
		functionSpy.and.callFake((number, object) => {
			expect(number).toEqual(124);
			expect(object).toEqual({a: 123});
			expect(promiseSpy).not.toHaveBeenCalled();
			expect(requestSpy).not.toHaveBeenCalled();
			done();
		});
		wrapped.fourthFunctionPromise(124, {a: 123});
	});
	describe('when the underlying method returns something with .promise', () => {
		it('does not resolve or reject until the underlying promise resolves', done => {
			const resolve = jasmine.createSpy('resolve'), reject = jasmine.createSpy('reject');
			wrapped.firstMethodPromise('124').then(resolve, reject);
			Promise.resolve().then(() => {
				expect(resolve).not.toHaveBeenCalled();
				expect(reject).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('resolves as soon as the underlying promise resolves', done => {
			wrapped.firstMethodPromise('124').then(res => {
				expect(res).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done, done.fail);
			promises.first.resolve('result');
		});
		it('rejects as soon as the underlying promise resolves with a non retriable error', done => {
			wrapped.firstMethodPromise('124').then(done.fail, err => {
				expect(err).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done);
			promises.first.reject('result');
		});
		it('retries TooManyRequestsException', done => {
			const sequence = [buildPromise('a'), buildPromise('b')],
				source = { retryAsync: () => {
					return sequence.shift();
				}},
				wrapped = underTest(source, onRetry, 10, 5);
			wrapped.retryAsyncPromise().then(result => {
				expect(onRetry).toHaveBeenCalled();
				expect(result).toEqual('good');
			}).then(done, done.fail);
			promises.a.reject({code: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
		it('fails TooManyRequestsException if over the retry limit', done => {
			const sequence = [buildPromise('a'), buildPromise('b'), buildPromise('c')],
				source = { retryAsync: () => {
					return sequence.shift();
				}},
				wrapped = underTest(source, onRetry, 10, 1);
			wrapped.retryAsyncPromise().then(done.fail, err => {
				expect(onRetry).not.toHaveBeenCalled();
				expect(err).toEqual({code: 'TooManyRequestsException'});
			}).then(done);
			promises.a.reject({code: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
	});
	describe('when the underlying method returns a thenable value without .promise', () => {
		it('does not resolve or reject until the underlying promise resolves', done => {
			const resolve = jasmine.createSpy('resolve'), reject = jasmine.createSpy('reject');
			wrapped.secondMethodPromise('124').then(resolve, reject);
			Promise.resolve().then(() => {
				expect(resolve).not.toHaveBeenCalled();
				expect(reject).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('resolves as soon as the underlying promise resolves', done => {
			wrapped.secondMethodPromise('124').then(res => {
				expect(res).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done, done.fail);
			promises.second.resolve('result');
		});
		it('rejects as soon as the underlying promise resolves with a non retriable error', done => {
			wrapped.secondMethodPromise('124').then(done.fail, err => {
				expect(err).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done);
			promises.second.reject('result');
		});
		it('retries TooManyRequestsException', done => {
			const sequence = [buildPromise('a'), buildPromise('b')],
				source = { retryAsync: () => {
					return sequence.shift();
				}},
				wrapped = underTest(source, onRetry, 10, 5);
			wrapped.retryAsyncPromise().then(result => {
				expect(onRetry).toHaveBeenCalled();
				expect(result).toEqual('good');
			}).then(done, done.fail);
			promises.a.reject({code: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
		it('fails TooManyRequestsException if over the retry limit', done => {
			const sequence = [buildPromise('a'), buildPromise('b'), buildPromise('c')],
				source = { retryAsync: () => {
					return sequence.shift();
				}},
				wrapped = underTest(source, onRetry, 10, 1);
			wrapped.retryAsyncPromise().then(done.fail, err => {
				expect(onRetry).not.toHaveBeenCalled();
				expect(err).toEqual({code: 'TooManyRequestsException'});
			}).then(done);
			promises.a.reject({code: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
	});
	describe('when the underlying method returns a primitive', () => {

		it('resolves immediately with the function result', done => {
			functionSpy.and.returnValue('result');
			wrapped.fourthFunctionPromise('124').then(res => {
				expect(res).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('rejects with the function exception', done => {
			functionSpy.and.throwError('boom');
			wrapped.fourthFunctionPromise('124').then(done.fail, err => {
				expect(err.message).toEqual('boom');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done);
		});
		describe('retrying', () => {
			let sequence;
			beforeEach(() => {
				sequence = ['TooManyRequestsException'];
				source = {
					fourthFunction: functionSpy
				};
				functionSpy.and.callFake(() => {
					const next = sequence.shift();
					if (next) {
						throw {code: next};
					} else {
						return 'good';
					}
				});
			});
			it('retries TooManyRequestsException', done => {
				wrapped = underTest(source, onRetry, 10, 5);

				wrapped.fourthFunctionPromise('A').then(result => {
					expect(onRetry).toHaveBeenCalled();
					expect(result).toEqual('good');
				}).then(done, done.fail);
			});
			it('does not retry other exceptions', done => {
				sequence.push('TooFewRequestsException');
				wrapped = underTest(source, onRetry, 10, 5);

				wrapped.fourthFunctionPromise('A').then(done.fail, err => {
					expect(onRetry).toHaveBeenCalled();
					expect(err).toEqual({code: 'TooFewRequestsException'});
				}).then(done, done.fail);
			});

			it('fails TooManyRequestsException if over the retry limit', done => {
				wrapped = underTest(source, onRetry, 10, 1);
				wrapped.fourthFunctionPromise('A').then(done.fail, err => {
					expect(onRetry).not.toHaveBeenCalled();
					expect(err).toEqual({code: 'TooManyRequestsException'});
				}).then(done, done.fail);
			});

		});
	});
	describe('working with AWS-SDK objects', () => {
		it('wraps API objects', done => {
			const sts = underTest(new aws.STS());
			expect(typeof sts.getCallerIdentityPromise).toBe('function');
			sts.getCallerIdentityPromise().then(callerIdentity => {
				expect(callerIdentity.Account).not.toBeUndefined();
			}).then(done, done.fail);
		});
	});
});
