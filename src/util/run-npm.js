const removeKeysWithPrefix = require('./remove-keys-with-prefix'),
	execPromise = require('./exec-promise'),
	fsPromise = require('./fs-promise'),
	tmppath = require('./tmppath');
module.exports = function runNpm(dir, options, logger) {
	'use strict';
	const npmlog = tmppath(),
		command = 'npm ' + options,
		env = removeKeysWithPrefix(process.env, 'npm_');
	logger.logApiCall(command);

	return execPromise(command + ' > ' + npmlog + ' 2>&1', {env: env, cwd: dir})
	.then(() => fsPromise.unlinkAsync(npmlog))
	.then(() => dir)
	.catch(() => {
		return Promise.reject(command + ' failed. Check ' + npmlog);
	});
};
