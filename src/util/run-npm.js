/*global module, require, Promise */
var shell = require('shelljs'),
	tmppath = require('./tmppath');
module.exports = function runNpm(dir, options, logger) {
	'use strict';
	var cwd = shell.pwd(),
		npmlog = tmppath(),
		command = shell.which('npm') + ' ' + options,
		env = shell.env;
	logger.logApiCall(command);
	shell.cd(dir);
	if (shell.test('-e', '.npmrc')) {
		env = {};
	}
	if (shell.exec(command + ' > ' + npmlog + ' 2>&1', {env: env}).code !== 0) {
		shell.cd(cwd);
		return Promise.reject(command + ' failed. Check ' + npmlog);
	}
	shell.rm(npmlog);
	shell.cd(cwd);
	return Promise.resolve(dir);
};

