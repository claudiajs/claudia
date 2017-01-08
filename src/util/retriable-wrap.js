const retry = require('oh-no-i-insist'),
	listWrappableFunctions = require('./list-wrappable-functions');

module.exports = function retriableWrap(apiObject, onRetry, timeout, retries, suffix) {
	'use strict';
	let rx;
	const remapKey = function (key) {
			let oldFunc = apiObject[key];
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
