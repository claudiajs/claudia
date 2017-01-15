const aws = require('aws-sdk');
module.exports = function listWrappableFunctions(object) {
	'use strict';
	const excluded = ['constructor'],
		excludedPrototypes = [Array.prototype, Object.prototype, Function.prototype, aws.Service.prototype],
		isFunction = function (key) {
			return typeof object[key] === 'function';
		},
		notExcluded = function (key) {
			return excluded.indexOf(key) < 0;
		},
		ownFunctions = function (target) {
			return Object.keys(target).filter(target.hasOwnProperty.bind(target)).filter(isFunction).filter(notExcluded);
		},
		hierarchicalFunctions = function (target) {
			const result = ownFunctions(target),
				proto = Object.getPrototypeOf(target);
			if (excludedPrototypes.indexOf(proto) < 0) {
				return result.concat(hierarchicalFunctions(proto));
			} else {
				return result;
			}
		};

	return hierarchicalFunctions(object);
};
