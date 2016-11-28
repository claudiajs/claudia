/*global module, require, Promise */
var tmppath = require('../util/tmppath'),
	readjson = require('../util/readjson'),
	runNpm = require('../util/run-npm'),
	shell = require('shelljs'),
	fs = require('fs'),
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
			if (!shell.test('-e', sourcePath)) {
				return 'source directory does not exist';
			}
			if (!shell.test('-d', sourcePath)) {
				return 'source path must be a directory';
			}
			if (!shell.test('-e', path.join(sourcePath, 'package.json'))) {
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
			shell.mkdir('-p', packDir);
			return runNpm(packDir, 'pack "' + path.resolve(sourcePath) + '"', logger).then(function () {
				return extractTarGz(path.join(packDir, expectedName), packDir);
			}).then(function () {
				shell.mv(path.join(packDir, 'package'), targetDir);
				shell.rm('-rf', packDir);
				return targetDir;
			});
		},
		installDependencies = function (targetDir) {
			if (useLocalDependencies) {
				shell.cp('-r', path.join(sourcePath, 'node_modules'), targetDir);
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
