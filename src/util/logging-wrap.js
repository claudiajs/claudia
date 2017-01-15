const listWrappableFunctions = require('./list-wrappable-functions');
module.exports = function loggingWrap(apiObject, options) {
	'use strict';
	const logPrefix = (options && options.logName && (options.logName + '.')) || '',
		magic = '__LOGGING_WRAP__',
		remapKey = function (key) {
			let oldFunc;
			if (!apiObject[key][magic]) {
				oldFunc = apiObject[key];
				apiObject[key] = function () {
					const callArgs = arguments;
					options.log(logPrefix + key, Array.prototype.slice.call(callArgs));
					return oldFunc.apply(apiObject, callArgs);
				};
				apiObject[key][magic] = magic;
			}
		};

	if (!options || !options.log) {
		return apiObject;
	}
	listWrappableFunctions(apiObject).forEach(remapKey);
	return apiObject;
};
