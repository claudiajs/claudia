module.exports = function removeKeysWithPrefix(object, prefix) {
	'use strict';
	const result = {};
	if (typeof object !== 'object') {
		return object;
	}
	Object.keys(object).forEach(key => {
		if (key.indexOf(prefix) !== 0) {
			result[key] = object[key];
		}
	});
	return result;
};
