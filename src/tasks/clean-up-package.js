/*global module, require, Promise */
var path = require('path'),
	fsUtil = require('../util/fs-util'),
	fsPromise = require('../util/fs-promise'),
	runNpm = require('../util/run-npm');
module.exports = function cleanUpPackage(packageDir, options, logger) {
	'use strict';
	var cleanUpDependencies = function () {
			if (options['optional-dependencies'] === false) {
				logger.logApiCall('removing optional dependencies');
				fsUtil.rmDir(path.join(packageDir, 'node_modules'));
				return runNpm(packageDir, 'install --production --no-optional', logger);
			} else {
				return Promise.resolve();
			}
		},
		removeNpmrc = function () {
			var npmrc = path.join(packageDir, '.npmrc');
			if (fsUtil.fileExists(npmrc)) {
				return fsPromise.unlinkAsync(npmrc);
			}
		};
	return cleanUpDependencies().then(removeNpmrc).then(function () {
		return packageDir;
	});
};
