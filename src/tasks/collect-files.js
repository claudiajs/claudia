const tmppath = require('../util/tmppath'),
	readjson = require('../util/readjson'),
	runNpm = require('../util/run-npm'),
	fsUtil = require('../util/fs-util'),
	fs = require('fs'),
	fsPromise = require('../util/fs-promise'),
	path = require('path'),
	localizeDependencies = require('./localize-dependencies'),
	expectedArchiveName = require('../util/expected-archive-name'),
	gunzip = require('gunzip-maybe'),
	tarStream = require('tar-fs'),
	NullLogger = require('../util/null-logger');

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
		extractTarGz = function (archive, dir) {
			return new Promise((resolve, reject) => {
				const extractStream = tarStream.extract(dir);
				extractStream.on('finish', resolve);
				extractStream.on('error', reject);
				fs.createReadStream(archive).pipe(gunzip()).pipe(extractStream);
			});
		},
		copyFiles = function (packageConfig) {
			const packDir = tmppath(),
				targetDir = tmppath(),
				expectedName = expectedArchiveName(packageConfig),
				absolutePath = path.resolve(sourcePath);
			fsUtil.ensureCleanDir(packDir);
			return runNpm(packDir, `pack "${absolutePath}"${npmOptions}`, logger)
			.then(() => extractTarGz(path.join(packDir, expectedName), packDir))
			.then(() => fsPromise.renameAsync(path.join(packDir, 'package'), targetDir))
			.then(() => {
				fsUtil.rmDir(packDir);
				return targetDir;
			});
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
	return readjson(path.join(sourcePath, 'package.json'))
	.then(copyFiles)
	.then(copyPackageLock)
	.then(rewireRelativeDependencies)
	.then(installDependencies);
};
