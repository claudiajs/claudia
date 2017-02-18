/*global require, module */
const readEnvVarsFromOptions = require('../util/read-env-vars-from-options'),
	mergeProperties = function (mergeTo, mergeFrom) {
		'use strict';
		Object.keys(mergeFrom).forEach(k => mergeTo[k] = mergeFrom[k]);
	};
module.exports = function initEnvVarsFromOptions(options) {
	'use strict';
	return new Promise(resolve => {
		const result = readEnvVarsFromOptions(options);
		if (result && result.Variables) {
			mergeProperties(process.env, result.Variables);
		}
		resolve(result);
	});
};

