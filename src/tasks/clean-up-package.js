const path = require('path'),
	fsUtil = require('../util/fs-util'),
	fsPromise = require('../util/fs-promise'),
	runNpm = require('../util/run-npm');
module.exports = function cleanUpPackage(packageDir, options, logger) {
	'use strict';
	const silentRemove = function (fileName) {
			const filePath = path.join(packageDir, fileName);
			if (fsUtil.fileExists(filePath)) {
				return fsPromise.unlinkAsync(filePath);
			} else {
				return Promise.resolve();
			}
		},
		cleanUpDependencies = function () {
			if (options['optional-dependencies'] === false) {
				logger.logApiCall('removing optional dependencies');
				fsUtil.rmDir(path.join(packageDir, 'node_modules'));
				return runNpm(packageDir, 'install --production --no-optional', logger);
			} else {
				return Promise.resolve();
			}
		};
	return silentRemove('package-lock.json')
	.then(cleanUpDependencies)
	.then(() => silentRemove('.npmrc'))
	.then(() => packageDir);
};
