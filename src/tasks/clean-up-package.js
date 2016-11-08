/*global module, require, Promise */
var shell = require('shelljs'),
	path = require('path'),
	runNpm = require('../util/run-npm');
module.exports = function cleanUpPackage(packageDir, options, logger) {
	'use strict';
	var cleanUpDependencies = function () {
		if (options['optional-dependencies'] === false) {
			logger.logApiCall('removing optional dependencies');
			shell.rm('-rf', path.join(packageDir, 'node_modules'));
			return runNpm(packageDir, 'install --production --no-optional', logger);
		} else {
			return Promise.resolve();
		}
	};
	return cleanUpDependencies().then(function () {
		shell.rm('-rf', path.join(packageDir, '.npmrc'));
		return packageDir;
	});
};
