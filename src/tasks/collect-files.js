/*global module, require */
var tmppath = require('../util/tmppath'),
	Promise = require('bluebird'),
	shell = require('shelljs');
module.exports = function collectFiles(config) {
	'use strict';
	var files, targetDir = tmppath(), cwd;
	if (!config.package.files) {
		return Promise.reject('package.json does not contain the files property');
	}
	files = ['package.json'].concat(config.package.files);

	shell.mkdir('-p', targetDir);
	files.forEach(function (file) {
		shell.cp('-R', file, targetDir);
	});

	if (config.package.dependencies) {
		cwd = shell.pwd();
		shell.cd(targetDir);
		if (shell.exec('npm install --production').code !== 0) {
			shell.cd(cwd);
			return Promise.reject('npm install --production failed');
		}
		shell.cd(cwd);
	}
	return Promise.resolve(targetDir);
};
