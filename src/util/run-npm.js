/*global module, require, Promise */
var shell = require('shelljs'),
	removeKeysWithPrefix = require('./remove-keys-with-prefix'),
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
	if (shell.exec(command + ' > ' + npmlog + ' 2>&1', {env: env}).code !== 0) {
		shell.cd(cwd);
		return Promise.reject(command + ' failed. Check ' + npmlog);
	}
	shell.rm(npmlog);
	shell.cd(cwd);
	return Promise.resolve(dir);
};

