/*global module */
module.exports = function removeKeysWithPrefix(object, prefix) {
	'use strict';
	var result = {};
	if (typeof object !== 'object') {
		return object;
	}
	Object.keys(object).forEach(function (key) {
		if (key.indexOf(prefix) !== 0) {
			result[key] = object[key];
		}
	});
	return result;
};
