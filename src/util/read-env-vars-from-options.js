const parseKeyValueCSV = require('./parse-key-value-csv'),
	countElements = require('../util/count-elements'),
	fs = require('fs');
module.exports = function readEnvVarsFromOptions(options) {
	'use strict';
	let envVars, fileContents, newFileContents;
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
			const fileName = options[method + '-env-from-json'],
				regex = /\${env\.(.*?)}/gi;
			fileContents = fs.readFileSync(fileName, 'utf8');
			newFileContents = fileContents.replace(regex, (match, envVarName) => {
				const val = process.env[envVarName];
				if (val !== undefined && val !== null) { // 0, false, and '' are ok.
					return val;
				}
				throw new Error(`Couldn't find expected env var '` + match + `' in file ` + fileName);
			});
			try {
				envVars = JSON.parse(newFileContents);
			} catch (e) {
				throw options[method + '-env-from-json'] + ' is not a valid JSON file';
			}
		}
	});
	return envVars;
};
