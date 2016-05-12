/*global require, module*/
var Promise = require('bluebird');
module.exports = function retry(promiseGenerator, delay, maxTimes, predicate, onRetry) {
	'use strict';
	if (!maxTimes) {
		return Promise.reject('failing to retry');
	}
	return promiseGenerator().catch(function (failure) {
		if (maxTimes > 1 && (!predicate || (predicate && predicate(failure)))) {
			if (onRetry) {
				onRetry();
			}
			return Promise.delay(delay).then(function () {
				return retry (promiseGenerator, delay, maxTimes - 1, predicate, onRetry);
			});
		} else {
			return Promise.reject(failure);
		}
	});
};
