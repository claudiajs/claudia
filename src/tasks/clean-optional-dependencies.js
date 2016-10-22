/*global module, require */
var shell = require('shelljs'),
	path = require('path'),
	runNpm = require('../util/run-npm');
module.exports = function cleanOptionalDependencies(packageDir, logger) {
	'use strict';
	logger.logApiCall('removing optional dependencies');
	shell.rm('-rf', path.join(packageDir, 'node_modules'));
	return runNpm(packageDir, 'install --production --no-optional', logger);
};
