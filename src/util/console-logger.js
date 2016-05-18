/*global module, process*/
module.exports = function ConsoleLogger(postfix, writable) {
	'use strict';
	var self = this,
		writer = writable || process.stderr,
		back = postfix || '\x1b[0G',
		currentStage = '',
		formatArg = function (argOb) {
			if (typeof argOb !== 'object') {
				return '';
			}
			return Object.keys(argOb).filter(function (useKey) {
				return /Name$/i.test(useKey) || /Id$/i.test(useKey) || /^path/i.test(useKey);
			}).sort().map(function (key) {
				return '\t' + key + '=' + argOb[key];
			}).join('');
		};
	self.logStage = function (stage) {
		currentStage = stage + '\t';
		writer.write(stage + back);
	};
	self.logApiCall = function (serviceCall, arg) {
		writer.write(currentStage + serviceCall + formatArg(arg) + back);
	};
};
