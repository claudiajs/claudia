/*global module */
module.exports = function mergeProperties(mergeTo, mergeFrom) {
	'use strict';
	Object.keys(mergeFrom).forEach(k => mergeTo[k] = mergeFrom[k]);
};

