/*global module, console */
module.exports = function ConsoleLogger(prefix, loggable) {
	'use strict';
	var self = this,
		writer = loggable || console,
		prepend = prefix || '\x1b[1F\x1b[2K',
		currentStage = '',
		currentPrepend = '',
		formatArg = function (argArr) {
			var argOb;
			if (!Array.isArray(argArr) || !argArr.length) {
				return '';
			}
			argOb = argArr[0];
			return Object.keys(argOb).filter(function (useKey) {
				return /Name$/i.test(useKey) || /Id$/i.test(useKey) || /^path/i.test(useKey);
			}).sort().map(function (key) {
				return '\t' + key + '=' + argOb[key];
			}).join('');
		};
	self.logStage = function (stage) {
		currentStage = stage + '\t';
		writer.log(currentPrepend + stage);
		currentPrepend = prepend;
	};
	self.logApiCall = function (serviceCall, arg) {
		writer.log(currentPrepend + currentStage + serviceCall + formatArg(arg));
		currentPrepend = prepend;
	};
};
