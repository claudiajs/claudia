const path = require('path'),
	fsUtil = require('../util/fs-util'),
	runNpm = require('../util/run-npm');
module.exports = function cleanUpPackage(packageDir, options, logger) {
	'use strict';
	const npmOptions = (options && options['npm-options']) ? (' ' + options['npm-options']) : '',
		dedupe = function () {
			return runNpm(packageDir, `dedupe --no-package-lock${npmOptions}`, logger);
		},
		runPostPackageScript = function () {
			const script = options['post-package-script'];
			if (script) {
				return runNpm(packageDir, `run ${script}${npmOptions}`, logger);
			}
		},
		fixFilePermissions = function (dir) {
			return dir;
		},
		cleanUpDependencies = function () {
			if (options['optional-dependencies'] === false) {
				logger.logApiCall('removing optional dependencies');
				fsUtil.rmDir(path.join(packageDir, 'node_modules'));
				return runNpm(packageDir, `install --no-package-lock --no-audit --production --no-optional${npmOptions}`, logger);
			}
		};
	return Promise.resolve()
	.then(() => fsUtil.silentRemove(path.join(packageDir, 'package-lock.json')))
	.then(cleanUpDependencies)
	.then(dedupe)
	.then(runPostPackageScript)
	.then(() => fsUtil.silentRemove(path.join(packageDir, '.npmrc')))
	.then(fixFilePermissions)
	.then(() => packageDir);
};
