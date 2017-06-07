/*global module */
module.exports = function countElements(object, keys) {
	'use strict';
	if (!object || !keys) {
		return 0;
	}
	return keys.filter(key => object[key]).length;
};
