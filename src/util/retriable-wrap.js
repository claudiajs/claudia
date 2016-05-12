/*global module, require*/
var retry = require('./retry');
module.exports = function retriableWrap(apiObject, onRetry, pattern, timeout, retries) {
	'use strict';
	timeout = timeout || 3000;
	retries = retries || 10;
	pattern = pattern || /Promise$/;
	Object.keys(apiObject).forEach(function (key) {
		var oldFunc;
		if (pattern.test(key) && (typeof apiObject[key] === 'function')) {
			oldFunc = apiObject[key];
			apiObject[key] = function () {
				var callArgs = arguments;
				return retry(
					function () {
						return oldFunc.apply(apiObject, callArgs);
					},
					timeout, retries,
					function (failure) {
						return failure.code && failure.code === 'TooManyRequestsException';
					},
					onRetry
				);
			};
		}
	});
	return apiObject;
};

