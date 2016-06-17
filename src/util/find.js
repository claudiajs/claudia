/*global module */
module.exports = function find(array, predicate, context) { /* no .find support in 10.0 */
	'use strict';
	array.forEach(function (element) {
		if (predicate(element, context)) {
			return element;
		}
	});
	return undefined;
};

