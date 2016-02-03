/*global describe, it, expect, jasmine, require */
describe('PromisingIterator', function () {
	'use strict';
	var PromisingIterator = require('../src/promising-iterator'),
		Promise = require('bluebird');
	it('resolves on an empty array without calling the generator', function (done) {
		var generator = jasmine.createSpy();
		new PromisingIterator([], generator).iterate().then(
			function (result) {
				expect(result).toEqual([]);
				expect(generator).not.toHaveBeenCalled();
			}
		).then(done, done.fail);
		expect(generator).not.toHaveBeenCalled();
	});
	describe('with a single-element array', function () {
		it('turns a single-arg array into a promise using the generator', function (done) {
			var promise,
				generator = function (number) {
					promise = Promise.resolve(number * 2);
					return promise;
				};
			new PromisingIterator([4], generator).iterate().then(function (result) {
				expect(result).toEqual([promise]);
			}).then(done, done.fail);
		});
		it('does not resolve before the internal promise', function (done) {
			var promise,
				hasResolved,
				generator = function (number) {
					promise = Promise.resolve(number * 2);
					return promise;
				};
			new PromisingIterator([4], generator).iterate().then(function () {
				hasResolved = true;
			});
			promise.then(function () {
				expect(hasResolved).toBeFalsy();
			}).then(done, done.fail);
		});
		it('resolves when the internal promise resolves', function (done) {
			var promise,
				hasResolved,
				generator = function (number) {
					promise = Promise.resolve(number * 2);
					promise.then(function () {
						hasResolved = true;
					});
					return promise;
				};
			new PromisingIterator([4], generator).iterate().then(function () {
				expect(hasResolved).toBeTruthy();
			}).then(done, done.fail);
		});
		it('resolves if the internal generator does not return a promise', function (done) {
			var wasCalled,
				generator = function (number) {
					wasCalled = true;
					return number;
				};
			new PromisingIterator([4], generator).iterate().then(function () {
				expect(wasCalled).toBeTruthy();
			}).then(done, done.fail);
		});
		it('resolves if the internal generator does not return', function (done) {
			var wasCalled,
				generator = function () {
					wasCalled = true;
				};
			new PromisingIterator([4], generator).iterate().then(function () {
				expect(wasCalled).toBeTruthy();
			}).then(done, done.fail);
		});

		it('rejects when the internal promise rejects', function (done) {
			var promise,
				hasResolved,
				hasRejected,
				generator = function (number) {
					promise = Promise.reject(number * 2);
					promise.then(function () {
						hasResolved = true;
					}, function () {
						hasRejected = true;
					});
					return promise;
				};
			new PromisingIterator([4], generator).iterate().then(done.fail,
			function () {
				expect(hasRejected).toBeTruthy();
				expect(hasResolved).toBeFalsy();
				done();
			});
		});
		it('rejects when there is an exception in the promise generator', function (done) {
			var generator = function () {
					return new Promise(function () {
						throw 'x';
					});
				};
			new PromisingIterator([4], generator).iterate().then(done.fail,
			function (reason) {
				expect(reason).toEqual('x');
				done();
			});
		});
	});
	describe('with a multi-element array', function () {
		it('turns an array into promises using the generator', function (done) {
			var promises = [],
				generator = function (number) {
					var promise = Promise.resolve(number * 2);
					promises.push(promise);
					return promise;
				};
			new PromisingIterator([4, 5], generator).iterate().then(function (result) {
				expect(result).toEqual(promises);
			}).then(done, done.fail);
		});
		it('does not create the second promise before the first resolves', function (done) {
			var promises = [],
				generator = function () {
					var promise = Promise.reject('x');
					promises.push(promise);
					return promise;
				};
			new PromisingIterator([4, 5], generator).iterate().then(done.reject,
				function () {
					expect(promises.length).toEqual(1);
					done();
				});
		});
		it('resolves only after the last promise resolves', function (done) {
			var promise,
				hasResolved,
				generator = function (number) {
					promise = Promise.resolve(number * 2);
					if (number == 5) {
						promise.then(function () {
							hasResolved = true;
						});
					}
					return promise;
				};
			new PromisingIterator([4, 5], generator).iterate().then(function () {
				expect(hasResolved).toBeTruthy();
			}).then(done, done.fail);
		});
		it('rejects when the first promise rejects', function (done) {
			var promises = [],
				generator = function (number) {
					var promise;
					if (number < 0) {
						promise = Promise.reject(number);
					} else {
						promise = Promise.resolve(number);
					}
					promises.push(promise);
					return promise;
				};
			new PromisingIterator([4, 5, -1, 7], generator).iterate().then(done.fail,
			function (reason) {
				expect(reason).toEqual(-1);
				expect(promises.length).toBe(3);
				done();
			});
		});
	});
});
