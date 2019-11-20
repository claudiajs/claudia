module.exports = function ConsoleLogger(prefix, loggable) {
	'use strict';
	let currentStage = '',
		currentPrepend = '';
	const writer = loggable || console,
		prepend = prefix || '\x1b[1F\x1b[2K',
		formatArg = function (argArr) {
			if (!Array.isArray(argArr) || !argArr.length) {
				return '';
			}
			const argOb = argArr[0];
			return Object.keys(argOb)
				.filter(useKey => /Name$/i.test(useKey) || /Id$/i.test(useKey) || /^path/i.test(useKey))
				.sort()
				.map(key => `\t${key}=${argOb[key]}`)
				.join('');
		};
	this.logStage = function (stage) {
		currentStage = stage + '\t';
		writer.error(currentPrepend + stage);
		currentPrepend = prepend;
	};
	this.logApiCall = function (serviceCall, arg) {
		writer.error(currentPrepend + currentStage + serviceCall + formatArg(arg));
		currentPrepend = prepend;
	};
};
