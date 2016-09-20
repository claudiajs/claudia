/*global module, require */
var Promise = require('bluebird'),
	fs = require('fs'),
	path = require('path'),
	Promise = require('bluebird'),
	writeFile = Promise.promisify(fs.writeFile),
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
		return writeFile(packagePath, JSON.stringify(content), {encoding: 'utf8'});
	});
};
