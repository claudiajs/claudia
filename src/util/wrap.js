/*global module, console, require*/
var retry = require('./retry');
module.exports = function wrap(logLabel, apiObject, verbose, timeout, retries) {
	'use strict';
	var timestamp = function () {
		return '[' + new Date().toLocaleTimeString() + ']';
	};
	timeout = timeout || 3000;
	retries = retries || 10;
	Object.keys(apiObject).forEach(function (key) {
		var oldFunc;
		if (/Async$/.test(key) && (typeof apiObject[key] === 'function')) {
			oldFunc = apiObject[key];
			apiObject[key] = function () {
				var callArgs = arguments;
				return retry(
					function () {
						if (verbose) {
							console.error(timestamp(), logLabel, key, callArgs && callArgs[0]);
						}
						return oldFunc.apply(apiObject, callArgs);
					},
					timeout, retries,
					function (failure) {
						var shouldRetry = failure.code && failure.code === 'TooManyRequestsException';
						if (verbose) {
							if (shouldRetry) {
								console.error(timestamp(), 'RETRIABLE FAIL, WILL RETRY', logLabel, key, failure);
							} else {
								console.error(timestamp(), 'FAILED', logLabel, key, failure);
							}
						}
						return shouldRetry;
					}
				);
			};
		}
	});
	return apiObject;
};

