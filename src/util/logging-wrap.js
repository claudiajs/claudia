/*global module, require */
var listWrappableFunctions = require('./list-wrappable-functions');
module.exports = function loggingWrap(apiObject, options) {
	'use strict';
	var logPrefix = (options && options.logName && (options.logName + '.')) || '',
		magic = '__LOGGING_WRAP__',
		remapKey = function (key) {
			var oldFunc;
			if (!apiObject[key][magic]) {
				oldFunc = apiObject[key];
				apiObject[key] = function () {
					var callArgs = arguments;
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
