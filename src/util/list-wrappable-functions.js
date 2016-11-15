/*global module */
module.exports = function listWrappableFunctions(object) {
	'use strict';
	var isFunction = function (key) {
			return typeof object[key] === 'function';
		},
		ownFunctions = function (target) {
			return Object.keys(target).filter(target.hasOwnProperty.bind(target)).filter(isFunction);
		};

	return ownFunctions(object).concat(ownFunctions(Object.getPrototypeOf(object)));
};
