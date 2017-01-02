/*global module, require, Promise, process */
var removeKeysWithPrefix = require('./remove-keys-with-prefix'),
	execPromise = require('./exec-promise'),
	fsUtil = require('./fs-util'),
	fs = require('./fs-promise'),
	tmppath = require('./tmppath');
module.exports = function runNpm(dir, options, logger) {
	'use strict';
	var cwd = process.cwd(),
		npmlog = tmppath(),
		command = 'npm ' + options,
		env = process.env;
	logger.logApiCall(command);
	process.chdir(dir);
	if (fsUtil.fileExists('.npmrc')) {
		env = removeKeysWithPrefix(process.env, 'npm_');
	}
	return execPromise(command + ' > ' + npmlog + ' 2>&1', {env: env}).then(function () {
		return fs.unlinkAsync(npmlog);
	}).then(function () {
		process.chdir(cwd);
		return dir;
	}).catch(function () {
		process.chdir(cwd);
		return Promise.reject(command + ' failed. Check ' + npmlog);
	});
};

