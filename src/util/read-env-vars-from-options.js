const parseKeyValueCSV = require('./parse-key-value-csv'),
	countElements = require('./count-elements'),
	fs = require('fs');
module.exports = function readEnvVarsFromOptions(options) {
	'use strict';
	let envVars, fileContents;
	if (!options) {
		return undefined;
	}
	const optionCount = countElements(options, ['set-env', 'set-env-from-json', 'update-env', 'update-env-from-json']);
	if (optionCount  > 1) {
		throw new Error('Incompatible arguments: cannot specify more than one environment option (--set-env, --set-env-from-json, --update-env, --update-env-from-json)');
	}
	['update', 'set'].forEach(method => {
		if (options[method + '-env']) {
			try {
				envVars = parseKeyValueCSV(options[method + '-env']);
			} catch (e) {
				throw 'Cannot read variables from ' + method + '-env, ' + e;
			}
		}
		if (options[method + '-env-from-json']) {
			fileContents = fs.readFileSync(options[method + '-env-from-json'], 'utf8');
			try {
				envVars = JSON.parse(fileContents);
			} catch (e) {
				throw options[method + '-env-from-json'] + ' is not a valid JSON file';
			}
		}
	});
	return envVars;
};
