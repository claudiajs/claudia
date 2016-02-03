/*global module, require*/
var Promise = require('bluebird');
module.exports = function PromisingIterator(objectArray, promiseGenerator) {
	'use strict';
	var self = this,
		resolver,
		rejecter,
		localArrayCopy,
		promiseArray,
		proceed = function () {
			var currentPromise, element;
			if (!localArrayCopy.length) {
				return resolver(promiseArray);
			}
			element = localArrayCopy.shift();
			currentPromise = promiseGenerator(element);
			if (!currentPromise || !currentPromise.then) {
				currentPromise = Promise.resolve(currentPromise);
			}
			promiseArray.push(currentPromise);
			currentPromise.then(proceed, rejecter);
		},
		executor = function (resolve, reject) {
			resolver = resolve;
			rejecter = reject;
			promiseArray = [];
			localArrayCopy = objectArray.slice(0);
			proceed();
		};
	self.iterate = function () {
		return new Promise(executor);
	};
};
