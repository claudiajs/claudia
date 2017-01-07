/*global module, console */
module.exports = function ConsoleLogger(prefix, loggable) {
	'use strict';
	let writer = loggable || console,
		prepend = prefix || '\x1b[1F\x1b[2K',
		currentStage = '',
		currentPrepend = '';
	const formatArg = function (argArr) {
		let argOb;
		if (!Array.isArray(argArr) || !argArr.length) {
			return '';
		}
		argOb = argArr[0];
		return Object.keys(argOb)
		.filter(useKey => /Name$/i.test(useKey) || /Id$/i.test(useKey) || /^path/i.test(useKey))
		.sort()
		.map(key => `\t${key}=${argOb[key]}`)
		.join('');
	};
	this.logStage = function (stage) {
		currentStage = stage + '\t';
		writer.log(currentPrepend + stage);
		currentPrepend = prepend;
	};
	this.logApiCall = function (serviceCall, arg) {
		writer.log(currentPrepend + currentStage + serviceCall + formatArg(arg));
		currentPrepend = prepend;
	};
};
