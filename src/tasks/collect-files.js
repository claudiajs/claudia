/*global module, require */
var tmppath = require('../util/tmppath'),
	readjson = require('../util/readjson'),
	Promise = require('bluebird'),
	shell = require('shelljs'),
	fs = require('fs'),
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
			var files, targetDir = tmppath(), includedFiles = packageConfig.files,
				removeAfterCopy = ['node_modules', '.git', '.gitignore', '*.swp', '._*', '.DS_Store', '.hg', '.npmrc', '.svn', 'config.gypi', 'CVS', 'npm-debug.log'],
				ignoreFileLists = ['.gitignore', '.npmignore'];
			if (!includedFiles) {
				includedFiles = '*';
			}
			files = ['package.json'].concat(includedFiles);
			shell.mkdir('-p', targetDir);
			files.forEach(function (file) {
				shell.cp('-rf', path.join(sourcePath, file), targetDir);
			});
			ignoreFileLists.forEach(function (ignoreFileListName) {
				var ignoreFile = path.join(sourcePath, ignoreFileListName), fileList;
				if (shell.test('-e', ignoreFile)) {
					fileList = fs.readFileSync(ignoreFile, 'utf8').split('\n');
					fileList.forEach(function (file) {
						if (file && file.trim() && file.trim()[0] !== '#') {
							removeAfterCopy.push(file);
						}
					});
				}
			});
			removeAfterCopy.forEach(function (ignoredName) {
				var ignoredFile = path.join(targetDir, ignoredName);
				shell.rm('-rf', ignoredFile);
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
