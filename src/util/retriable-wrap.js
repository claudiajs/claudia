/*global module, require, Promise*/
var retry = require('oh-no-i-insist'),
	listWrappableFunctions = require('./list-wrappable-functions');

module.exports = function retriableWrap(apiObject, onRetry, timeout, retries, suffix) {
	'use strict';
	var rx,
		remapKey = function (key) {
			var oldFunc;
			oldFunc = apiObject[key];
			apiObject[key + suffix] = function () {
				var callArgs = arguments;
				return retry(
					function () {
						var result = oldFunc.apply(apiObject, callArgs);
						if (result && result.promise && typeof result.promise === 'function') {
							return result.promise();
						} else {
							return result;
						}
					},
					timeout, retries,
					function (failure) {
						return failure.code && failure.code === 'TooManyRequestsException';
					},
					onRetry,
					Promise
				);
			};
		},
		matching = function (key) {
			return !rx.test(key);
		};

	timeout = timeout || 3000;
	retries = retries || 10;
	suffix = suffix || 'Promise';
	rx = new RegExp(suffix + '$');

	listWrappableFunctions(apiObject).filter(matching).forEach(remapKey);

	return apiObject;
};

