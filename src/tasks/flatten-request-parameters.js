/*global module */
var extractPathParams = function (string) {
	'use strict';
	var paramRegex = /\{([^+}]+)\+?\}/g,
		results = [],
		match;
	while ((match = paramRegex.exec(string)) !== null) {
		results.push(match[1]);
	}
	return results;
};
module.exports = function flattenRequestParameters(paramMap, resourcePath) {
	'use strict';
	var result = {},
		pathParams = extractPathParams(resourcePath);
	if (!paramMap && !pathParams.length) {
		return paramMap;
	}
	if (paramMap) {
		Object.keys(paramMap).forEach(function (key) {
			if (typeof paramMap[key] === 'object') {
				Object.keys(paramMap[key]).forEach(function (subkey) {
					result['method.request.' + key + '.' + subkey] = paramMap[key][subkey];
				});
			} else {
				result[key] = paramMap[key];
			}
		});
	}
	pathParams.forEach(function (param) {
		result['method.request.path.' + param] = true;
	});
	return result;
};
