const extractPathParams = function (string) {
	'use strict';
	let match;
	const paramRegex = /\{([^+}]+)\+?\}/g,
		results = [];
	while ((match = paramRegex.exec(string)) !== null) {
		results.push(match[1]);
	}
	return results;
};
module.exports = function flattenRequestParameters(paramMap, resourcePath) {
	'use strict';
	const result = {},
		pathParams = extractPathParams(resourcePath);
	if (!paramMap && !pathParams.length) {
		return paramMap;
	}
	if (paramMap) {
		Object.keys(paramMap).forEach(key => {
			if (typeof paramMap[key] === 'object') {
				Object.keys(paramMap[key]).forEach(subkey => {
					result[`method.request.${key}.${subkey}`] = paramMap[key][subkey];
				});
			} else {
				result[key] = paramMap[key];
			}
		});
	}
	pathParams.forEach(param => {
		result[`method.request.path.${param}`] = true;
	});
	return result;
};
