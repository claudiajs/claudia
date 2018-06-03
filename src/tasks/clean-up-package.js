const path = require('path'),
	fsUtil = require('../util/fs-util'),
	fsPromise = require('../util/fs-promise'),
	runNpm = require('../util/run-npm');
module.exports = function cleanUpPackage(packageDir, options, logger) {
	'use strict';
	const npmOptions = (options && options['npm-options']) ? (' ' + options['npm-options']) : '',
		silentRemove = function (fileName) {
			const filePath = path.join(packageDir, fileName);
			if (fsUtil.fileExists(filePath)) {
				return fsPromise.unlinkAsync(filePath);
			} else {
				return Promise.resolve();
			}
		},
		dedupe = function () {
			return runNpm(packageDir, `dedupe${npmOptions}`, logger);
		},
		cleanUpDependencies = function () {
			if (options['optional-dependencies'] === false) {
				logger.logApiCall('removing optional dependencies');
				fsUtil.rmDir(path.join(packageDir, 'node_modules'));
				return runNpm(packageDir, `install --no-audit --production --no-optional${npmOptions}`, logger);
			} else {
				return Promise.resolve();
			}
		};
	return silentRemove('package-lock.json')
	.then(cleanUpDependencies)
	.then(dedupe)
	.then(() => silentRemove('.npmrc'))
	.then(() => packageDir);
};
