/*global module, require, Promise */
var tmppath = require('../util/tmppath'),
	readjson = require('../util/readjson'),
	runNpm = require('../util/run-npm'),
	fsUtil = require('../util/fs-util'),
	fs = require('../util/fs-promise'),
	path = require('path'),
	localizeDependencies = require('./localize-dependencies'),
	expectedArchiveName = require('../util/expected-archive-name'),
	gunzip = require('gunzip-maybe'),
	tarStream = require('tar-fs'),
	NullLogger = require('../util/null-logger');

module.exports = function collectFiles(sourcePath, useLocalDependencies, optionalLogger) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		checkPreconditions = function () {
			if (!sourcePath) {
				return 'source directory not provided';
			}
			if (!fsUtil.fileExists(sourcePath)) {
				return 'source directory does not exist';
			}
			if (!fsUtil.isDir(sourcePath)) {
				return 'source path must be a directory';
			}
			if (!fsUtil.fileExists(path.join(sourcePath, 'package.json'))) {
				return 'source directory does not contain package.json';
			}
		},
		extractTarGz = function (archive, dir) {
			return new Promise(function (resolve, reject) {
				var extractStream = tarStream.extract(dir);
				extractStream.on('finish', resolve);
				extractStream.on('error', reject);
				fs.createReadStream(archive).pipe(gunzip()).pipe(extractStream);
			});
		},
		copyFiles = function (packageConfig) {
			var packDir = tmppath(),
				targetDir = tmppath(),
				expectedName = expectedArchiveName(packageConfig);
			fsUtil.ensureCleanDir(packDir);
			return runNpm(packDir, 'pack "' + path.resolve(sourcePath) + '"', logger).then(function () {
				return extractTarGz(path.join(packDir, expectedName), packDir);
			}).then(function () {
				return fs.renameAsync(path.join(packDir, 'package'), targetDir);
			}).then(function () {
				fsUtil.rmDir(packDir);
				return targetDir;
			});
		},
		installDependencies = function (targetDir) {
			if (useLocalDependencies) {
				fsUtil.copy(path.join(sourcePath, 'node_modules'), targetDir);
				return Promise.resolve(targetDir);
			} else {
				return runNpm(targetDir, 'install --production', logger);
			}
		},
		rewireRelativeDependencies = function (targetDir) {
			return localizeDependencies(targetDir, sourcePath).then(function () {
				return targetDir;
			});
		},
		validationError = checkPreconditions(sourcePath);
	logger.logStage('packaging files');
	if (validationError) {
		return Promise.reject(validationError);
	}
	return readjson(path.join(sourcePath, 'package.json')).
		then(copyFiles).
		then(rewireRelativeDependencies).
		then(installDependencies);
};
