const readEnvVarsFromOptions = require('../util/read-env-vars-from-options'),
	mergeProperties = require('../util/merge-properties');
module.exports = function initEnvVarsFromOptions(options) {
	'use strict';
	return new Promise(resolve => {
		const result = readEnvVarsFromOptions(options);
		if (result) {
			mergeProperties(process.env, result);
		}
		resolve(result && {Variables: result});
	});
};

