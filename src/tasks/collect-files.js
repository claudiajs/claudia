const readjson = require('../util/readjson'),
	runNpm = require('../util/run-npm'),
	fsUtil = require('../util/fs-util'),
	extractTar = require('../util/extract-tar'),
	fsPromise = require('../util/fs-promise'),
	path = require('path'),
	localizeDependencies = require('./localize-dependencies'),
	NullLogger = require('../util/null-logger'),
	packProjectToTar = require('../util/pack-project-to-tar');

/*
 * Creates a directory with a NPM project and all production dependencies localised,
 * ready for zipping and uploading to lambda. It will also rewire all local file: dependencies
 * correctly to work with NPM5
 *
 * Arguments:
 *
 * - sourcePath: a path to a NPM project directory, containing package.json
 * - workingDir: a directory where it is safe to create files, the resulting dir will be a subdirectory here
 * - useLocalDependencies: boolean -- if true, existing node_modules will be copied instead of reinstalling
 * - optionalLogger: log reporter
 *
 * Returns:
 *
 * A path to a directory containing all dependencies. Other files required to reinstall the package will be stored in the workingDir
 */
module.exports = function collectFiles(sourcePath, workingDir, options, optionalLogger) {
	'use strict';
	const logger = optionalLogger || new NullLogger(),
		useLocalDependencies = options && options['use-local-dependencies'],
		npmOptions = (options && options['npm-options']) ? (' ' + options['npm-options']) : '',
		checkPreconditions = function (providedSourcePath) {
			if (!providedSourcePath) {
				return 'source directory not provided';
			}
			if (!fsUtil.fileExists(providedSourcePath)) {
				return 'source directory does not exist';
			}
			if (!fsUtil.isDir(providedSourcePath)) {
				return 'source path must be a directory';
			}
			if (!workingDir) {
				return 'working directory not provided';
			}
			if (!fsUtil.fileExists(workingDir)) {
				return 'working directory does not exist';
			}
			if (!fsUtil.isDir(workingDir)) {
				return 'working directory must be a directory';
			}

			if (!fsUtil.fileExists(path.join(providedSourcePath, 'package.json'))) {
				return 'source directory does not contain package.json';
			}
		},
		copyFiles = function (projectDir) {
			return packProjectToTar(projectDir, workingDir, npmOptions, logger)
			.then(archive => extractTar(archive, path.dirname(archive)))
			.then(archiveDir => path.join(archiveDir, 'package'));
		},
		installDependencies = function (targetDir) {
			if (useLocalDependencies) {
				fsUtil.copy(path.join(sourcePath, 'node_modules'), targetDir);
				return Promise.resolve(targetDir);
			} else {
				return runNpm(targetDir, `install --production${npmOptions}`, logger);
			}
		},
		rewireRelativeDependencies = function (targetDir) {
			return localizeDependencies(targetDir, sourcePath)
			.then(() => targetDir);
		},
		copyPackageLock = function (targetDir) {
			return readjson(path.join(sourcePath, 'package-lock.json'))
			.catch(() => false)
			.then(packageLock => {
				if (packageLock) {
					return fsPromise.writeFileAsync(path.join(targetDir, 'package-lock.json'), JSON.stringify(packageLock), 'utf8');
				}
			})
			.then(() => targetDir);
		},
		validationError = checkPreconditions(sourcePath);
	logger.logStage('packaging files');
	if (validationError) {
		return Promise.reject(validationError);
	}
	return copyFiles(sourcePath)
	.then(copyPackageLock)
	.then(rewireRelativeDependencies)
	.then(installDependencies);
};
