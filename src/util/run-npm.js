const removeKeysWithPrefix = require('./remove-keys-with-prefix'),
	execPromise = require('./exec-promise'),
	fsUtil = require('./fs-util'),
	fsPromise = require('./fs-promise'),
	tmppath = require('./tmppath');
module.exports = function runNpm(dir, options, logger) {
	'use strict';
	const cwd = process.cwd(),
		npmlog = tmppath(),
		command = 'npm ' + options;
	let env = process.env;
	logger.logApiCall(command);
	process.chdir(dir);
	if (fsUtil.fileExists('.npmrc')) {
		env = removeKeysWithPrefix(process.env, 'npm_');
	}
	return execPromise(command + ' > ' + npmlog + ' 2>&1', {env: env})
	.then(() => fsPromise.unlinkAsync(npmlog))
	.then(() => {
		process.chdir(cwd);
		return dir;
	})
	.catch(() => {
		process.chdir(cwd);
		return Promise.reject(command + ' failed. Check ' + npmlog);
	});
};
