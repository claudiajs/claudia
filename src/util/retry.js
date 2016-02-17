/*global require, module */
var Promise = require('bluebird');
module.exports = function retry(promiseGenerator, delay, maxTimes, predicate) {
	'use strict';
	if (!maxTimes) {
		return Promise.reject('failing to retry');
	}
	return promiseGenerator().catch(function (failure) {
		if (maxTimes > 1 && (!predicate || (predicate && predicate(failure)))) {
			return Promise.delay(delay).then(function () {
				return retry (promiseGenerator, delay, maxTimes - 1, predicate);
			});
		} else {
			return Promise.reject(failure);
		}
	});
};
