const retry = require('oh-no-i-insist'),
	listWrappableFunctions = require('./list-wrappable-functions');

module.exports = function retriableWrap(apiObject, onRetry, timeout, retries, suffix) {
	'use strict';
	timeout = timeout || 3000;
	retries = retries || 10;
	suffix = suffix || 'Promise';

	const remapKey = function (key) {
			const oldFunc = apiObject[key];
			apiObject[key + suffix] = function () {
				const callArgs = arguments;
				return retry(
					() => {
						const result = oldFunc.apply(apiObject, callArgs);
						if (result && result.promise && typeof result.promise === 'function') {
							return result.promise();
						} else {
							return result;
						}
					},
					timeout,
					retries,
					failure => failure.code && failure.code === 'TooManyRequestsException',
					onRetry,
					Promise
				);
			};
		},
		rx = new RegExp(suffix + '$'),
		matching = function (key) {
			return !rx.test(key);
		};

	listWrappableFunctions(apiObject).filter(matching).forEach(remapKey);

	return apiObject;
};
