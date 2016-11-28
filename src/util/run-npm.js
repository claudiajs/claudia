/*global module, require, Promise */
var shell = require('shelljs'),
	removeKeysWithPrefix = require('./remove-keys-with-prefix'),
	execPromise = require('./exec-promise'),
	tmppath = require('./tmppath');
module.exports = function runNpm(dir, options, logger) {
	'use strict';
	var cwd = shell.pwd().toString(),
		npmlog = tmppath(),
		command = 'npm ' + options,
		env = shell.env;
	logger.logApiCall(command);
	shell.cd(dir);
	if (shell.test('-e', '.npmrc')) {
		env = removeKeysWithPrefix(shell.env, 'npm_');
	}
	return execPromise(command + ' > ' + npmlog + ' 2>&1', {env: env}).then(function () {
		shell.rm(npmlog);
		shell.cd(cwd);
		return dir;
	}).catch(function () {
		shell.cd(cwd);
		return Promise.reject(command + ' failed. Check ' + npmlog);
	});
};

