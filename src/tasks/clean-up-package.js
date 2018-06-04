const path = require('path'),
	fsUtil = require('../util/fs-util'),
	fsPromise = require('../util/fs-promise'),
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
		fixEntryPermissions = function (path) {
			return fsPromise.statAsync(path)
			.then(stats => {
				const requiredMode = stats.isDirectory() ? 0o755 : 0o644;
				return (stats.mode & 0o777) | requiredMode;
			})
			.then(mode => fsPromise.chmodAsync(path, mode));
		},
		fixFilePermissions = function () {
			return Promise.all(
				fsUtil.recursiveList(packageDir)
				.map(component => fixEntryPermissions(path.join(packageDir, component)))
			);
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
