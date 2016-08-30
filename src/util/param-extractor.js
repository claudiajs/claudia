/*global module */
module.exports = function paramExtractor(pathString) {
	'use strict';
	var pathComponents = pathString.split('/'),
		apiParamsRegex = /\{(.*)\}/g, params = [];

	pathComponents.forEach(function (pathComponent) {
		if (pathComponent.match(apiParamsRegex)) {
			params.push(apiParamsRegex.exec(pathComponent)[1]);
		}
	});

	return params;
};
