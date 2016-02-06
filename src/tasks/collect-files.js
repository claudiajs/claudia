/*global module, require */
var tmppath = require('../util/tmppath'),
	readjson = require('../util/readjson'),
	Promise = require('bluebird'),
	shell = require('shelljs'),
	path = require('path');

module.exports = function collectFiles(sourcePath) {
	'use strict';
	var checkPreconditions = function () {
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
		copyFiles = function (packageConfig) {
			var files, targetDir = tmppath();
			if (!packageConfig.files) {
				return Promise.reject('package.json does not contain the files property');
			}
			files = ['package.json'].concat(packageConfig.files);
			shell.mkdir('-p', targetDir);
			files.forEach(function (file) {
				shell.cp('-r', path.join(sourcePath, file), targetDir);
			});
			return Promise.resolve(targetDir);
		},
		installDependencies = function (targetDir) {
			var cwd = shell.pwd(),
				npmlog = tmppath();
			shell.cd(targetDir);
			if (shell.exec('npm install --production > ' + npmlog + ' 2>&1').code !== 0) {
				shell.cd(cwd);
				return Promise.reject('npm install --production failed. Check ' + npmlog);
			}
			shell.cd(cwd);
			return Promise.resolve(targetDir);
		},
		validationError = checkPreconditions(sourcePath);
	if (validationError) {
		return Promise.reject(validationError);
	}
	return readjson(path.join(sourcePath, 'package.json')).
		then(copyFiles).
		then(installDependencies);
};
