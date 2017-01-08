const readEnvVarsFromOptions = require('../util/read-env-vars-from-options');
module.exports = function updateEnvVars(options, lambdaAPI, functionName) {
	'use strict';
	const kmsKey = options['env-kms-key-arn'],
		envVars = readEnvVarsFromOptions(options),
		configUpdate = {};
	let shouldUpdate = false;
	if (envVars) {
		shouldUpdate = true;
		configUpdate.Environment = envVars;
	}
	if (kmsKey || kmsKey === '') {
		shouldUpdate = true;
		configUpdate.KMSKeyArn = kmsKey;
	}
	if (!shouldUpdate) {
		return Promise.resolve();
	}
	configUpdate.FunctionName = functionName;
	return lambdaAPI.updateFunctionConfiguration(configUpdate).promise();
};
