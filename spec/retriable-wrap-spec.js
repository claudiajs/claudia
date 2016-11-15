/* global require, describe, it, expect, beforeEach, jasmine, Promise*/
var underTest = require('../src/util/retriable-wrap'),
	aws = require('aws-sdk');
describe('retriableWrap', function () {
	'use strict';
	var source,
		requestSpy,
		promiseSpy,
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
		requestMock,
		functionSpy,
		onRetry;
	beforeEach(function () {
		promises = {};
		requestMock = jasmine.createSpyObj('requestMock', ['promise']);
		requestMock.promise.and.returnValue(buildPromise('first'));
		requestSpy = jasmine.createSpy('first').and.returnValue(requestMock);
		functionSpy = jasmine.createSpy('third');
		promiseSpy = jasmine.createSpy('second').and.returnValue(buildPromise('second'));

		onRetry = jasmine.createSpy('onRetry');
		thirdSpy = jasmine.createSpy('third').and.returnValue(3);
		source = {firstMethod: requestSpy, secondMethod: promiseSpy, thirdField: 5, fourthFunction: functionSpy};

		wrapped = underTest(source, onRetry);
	});
	it('wraps all methods matching the pattern', function () {
		expect(typeof wrapped.firstMethodPromise).toBe('function');
		expect(typeof wrapped.secondMethodPromise).toBe('function');
		expect(wrapped.firstMethodPromise).not.toEqual(requestSpy);
		expect(wrapped.secondMethodPromise).not.toEqual(promiseSpy);
	});
	it('skips matching properties that are not functions', function () {
		expect(wrapped.thirdField).toEqual(5);
		expect(wrapped.thirdFieldPromise).toBeUndefined();
	});
	it('proxies calls to request methods', function (done) {
		requestSpy.and.callFake(function (number, object) {
			expect(number).toEqual(124);
			expect(object).toEqual({a: 123});
			done();
		});
		wrapped.firstMethodPromise(124, {a: 123});
	});
	it('proxies calls to promise methods', function (done) {
		promiseSpy.and.callFake(function (number, object) {
			expect(number).toEqual(124);
			expect(object).toEqual({a: 123});
			expect(functionSpy).not.toHaveBeenCalled();
			expect(requestSpy).not.toHaveBeenCalled();
			done();
		});
		wrapped.secondMethodPromise(124, {a: 123});
	});
	it('proxies calls to functions', function (done) {
		functionSpy.and.callFake(function (number, object) {
			expect(number).toEqual(124);
			expect(object).toEqual({a: 123});
			expect(promiseSpy).not.toHaveBeenCalled();
			expect(requestSpy).not.toHaveBeenCalled();
			done();
		});
		wrapped.fourthFunctionPromise(124, {a: 123});
	});
	describe('when the underlying method returns something with .promise', function () {
		it('does not resolve or reject until the underlying promise resolves', function (done) {
			var resolve = jasmine.createSpy('resolve'), reject = jasmine.createSpy('reject');
			wrapped.firstMethodPromise('124').then(resolve, reject);
			Promise.resolve().then(function () {
				expect(resolve).not.toHaveBeenCalled();
				expect(reject).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('resolves as soon as the underlying promise resolves', function (done) {
			wrapped.firstMethodPromise('124').then(function (res) {
				expect(res).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done, done.fail);
			promises.first.resolve('result');
		});
		it('rejects as soon as the underlying promise resolves with a non retriable error', function (done) {
			wrapped.firstMethodPromise('124').then(done.fail, function (err) {
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
				wrapped = underTest(source, onRetry, 10, 5);
			wrapped.retryAsyncPromise().then(function (result) {
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
				wrapped = underTest(source, onRetry, 10, 1);
			wrapped.retryAsyncPromise().then(done.fail, function (err) {
				expect(onRetry).not.toHaveBeenCalled();
				expect(err).toEqual({code: 'TooManyRequestsException'});
			}).then(done);
			promises.a.reject({code: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
	});
	describe('when the underlying method returns a thenable value without .promise', function () {
		it('does not resolve or reject until the underlying promise resolves', function (done) {
			var resolve = jasmine.createSpy('resolve'), reject = jasmine.createSpy('reject');
			wrapped.secondMethodPromise('124').then(resolve, reject);
			Promise.resolve().then(function () {
				expect(resolve).not.toHaveBeenCalled();
				expect(reject).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('resolves as soon as the underlying promise resolves', function (done) {
			wrapped.secondMethodPromise('124').then(function (res) {
				expect(res).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done, done.fail);
			promises.second.resolve('result');
		});
		it('rejects as soon as the underlying promise resolves with a non retriable error', function (done) {
			wrapped.secondMethodPromise('124').then(done.fail, function (err) {
				expect(err).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done);
			promises.second.reject('result');
		});
		it('retries TooManyRequestsException', function (done) {
			var sequence = [buildPromise('a'), buildPromise('b')],
				source = { retryAsync: function () {
					return sequence.shift();
				}},
				wrapped = underTest(source, onRetry, 10, 5);
			wrapped.retryAsyncPromise().then(function (result) {
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
				wrapped = underTest(source, onRetry, 10, 1);
			wrapped.retryAsyncPromise().then(done.fail, function (err) {
				expect(onRetry).not.toHaveBeenCalled();
				expect(err).toEqual({code: 'TooManyRequestsException'});
			}).then(done);
			promises.a.reject({code: 'TooManyRequestsException'});
			promises.b.resolve('good');
		});
	});
	describe('when the underlying method returns a primitive', function () {

		it('resolves immediately with the function result', function (done) {
			functionSpy.and.returnValue('result');
			wrapped.fourthFunctionPromise('124').then(function (res) {
				expect(res).toEqual('result');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done, done.fail);
		});
		it('rejects with the function exception', function (done) {
			functionSpy.and.throwError('boom');
			wrapped.fourthFunctionPromise('124').then(done.fail, function (err) {
				expect(err.message).toEqual('boom');
				expect(onRetry).not.toHaveBeenCalled();
			}).then(done);
		});
		describe('retrying', function () {
			var sequence;
			beforeEach(function () {
				sequence = ['TooManyRequestsException'];
				source = {
					fourthFunction: functionSpy
				};
				functionSpy.and.callFake(function () {
					var next = sequence.shift();
					if (next) {
						throw {code: next};
					} else {
						return 'good';
					}
				});
			});
			it('retries TooManyRequestsException', function (done) {
				wrapped = underTest(source, onRetry, 10, 5);

				wrapped.fourthFunctionPromise('A').then(function (result) {
					expect(onRetry).toHaveBeenCalled();
					expect(result).toEqual('good');
				}).then(done, done.fail);
			});
			it('does not retry other exceptions', function (done) {
				sequence.push('TooFewRequestsException');
				wrapped = underTest(source, onRetry, 10, 5);

				wrapped.fourthFunctionPromise('A').then(done.fail, function (err) {
					expect(onRetry).toHaveBeenCalled();
					expect(err).toEqual({code: 'TooFewRequestsException'});
				}).then(done, done.fail);
			});

			it('fails TooManyRequestsException if over the retry limit', function (done) {
				wrapped = underTest(source, onRetry, 10, 1);
				wrapped.fourthFunctionPromise('A').then(done.fail, function (err) {
					expect(onRetry).not.toHaveBeenCalled();
					expect(err).toEqual({code: 'TooManyRequestsException'});
				}).then(done, done.fail);
			});

		});
	});
	describe('working with AWS-SDK objects', function () {
		it('wraps API objects', function (done) {
			var sts = underTest(new aws.STS());
			expect(typeof sts.getCallerIdentityPromise).toBe('function');
			sts.getCallerIdentityPromise().then(function (callerIdentity) {
				expect(callerIdentity.Account).not.toBeUndefined();
			}).then(done, done.fail);
		});
	});
});
