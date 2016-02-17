/*global module */
module.exports = function find(array, predicate, context) { /* no .find support in 10.0 */
	'use strict';
	var result;
	array.forEach(function (element) {
		if (!result && predicate(element, context)) {
			result = element;
		}
	});
	return result;
};

