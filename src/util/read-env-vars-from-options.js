const parseKeyValueCSV = require('./parse-key-value-csv'),
	fs = require('fs');
module.exports = function readEnvVarsFromOptions(options) {
	'use strict';
	let envVars, fileContents;
	if (!options) {
		return undefined;
	}
	if (options['set-env'] && options['set-env-from-json']) {
		throw 'Incompatible arguments: cannot specify both --set-env and --set-env-from-json';
	}

	if (options['set-env']) {
		try {
			envVars = parseKeyValueCSV(options['set-env']);
		} catch (e) {
			throw 'Cannot read variables from set-env, ' + e;
		}
	}
	if (options['set-env-from-json']) {
		fileContents = fs.readFileSync(options['set-env-from-json'], 'utf8');
		try {
			envVars = JSON.parse(fileContents);
		} catch (e) {
			throw options['set-env-from-json'] + ' is not a valid JSON file';
		}
	}
	return envVars && {
		Variables: envVars
	};
};
