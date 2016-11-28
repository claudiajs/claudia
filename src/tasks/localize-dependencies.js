/*global module, require */
var fs = require('../util/fs-promise'),
	path = require('path'),
	shell = require('shelljs'),
	readjson = require('../util/readjson');

module.exports = function (workdir, referencedir) {
	'use strict';
	var packagePath = path.join(workdir, 'package.json'),
		isLocalPath = function (str) {
			// startsWith not available in 0.10
			return str && (str[0] === '.' || str.indexOf('file:.') === 0);
		},
		localize = function (props) {
			if (!props) {
				return;
			}
			Object.keys(props).forEach(function (key) {
				if (isLocalPath(props[key])) {
					props[key] = 'file:' + path.resolve(referencedir, props[key].replace(/^file:/, ''));
				}
			});
		};
	return readjson(packagePath).then(function (content) {
		['dependencies', 'devDependencies', 'optionalDependencies'].forEach(function (depType) {
			localize(content[depType]);
		});
		return content;
	}).then(function (content) {
		return fs.writeFileAsync(packagePath, JSON.stringify(content), {encoding: 'utf8'});
	}).then(function () {
		var npmRcPath = path.join(referencedir, '.npmrc');
		if (shell.test('-e', npmRcPath)) {
			shell.cp(npmRcPath, workdir);
		}
	});
};
