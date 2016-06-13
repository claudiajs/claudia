/*global require, module */
var Bluebird = require('bluebird');
module.exports = function promiseWrap(target, optionsArg) {
	'use strict';
	var options = optionsArg || {},
		suffix = options.suffix || 'Promise',
		bbOptions = { suffix: suffix },
		logPrefix = (options.logName && (options.logName + '.')) || '',
		loggingWrap = function (apiObject) {
			if (!options.log) {
				return apiObject;
			}
			Object.keys(apiObject).forEach(function (key) {
				var oldFunc, rx = new RegExp(suffix + '$');
				if (rx.test(key) && (typeof apiObject[key] === 'function')) {
					oldFunc = apiObject[key];
					apiObject[key] = function () {
						var callArgs = arguments;
						options.log(logPrefix + key.replace(rx, ''), Array.prototype.slice.call(callArgs));
						return oldFunc.apply(apiObject, callArgs);
					};
				}
			});
			return apiObject;
		};
	return loggingWrap(Bluebird.promisifyAll(target, bbOptions));

};
