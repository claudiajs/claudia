/*global module, require */
var shell = require('shelljs'),
	Promise = require('bluebird'),
	tmppath = require('../util/tmppath');
module.exports = function cleanOptionalDependencies(packageDir, logger) {
	'use strict';
	var cwd = shell.pwd(),
	npmlog = tmppath();
	logger.logApiCall('removing optional dependencies');
	shell.cd(packageDir);
	shell.rm('-rf', 'node_modules');
	if (shell.exec('npm install --production --no-optional > ' + npmlog + ' 2>&1').code !== 0) {
		shell.cd(cwd);
		return Promise.reject('npm install --production failed. Check ' + npmlog);
	}
	shell.cd(cwd);
	return Promise.resolve(packageDir);
};
