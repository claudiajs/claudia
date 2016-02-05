/*global module, require*/
var shell = require('shelljs'),
	fs = require('fs'),
	Promise = require('bluebird'),
	readFile = Promise.promisify(fs.readFile),
	readAsJSON = function (fileName) {
		'use strict';
		if (!shell.test('-e', fileName)) {
			return Promise.reject(fileName + ' is missing');
		}
		return readFile(fileName, {encoding: 'utf8'}).then(function (content) {
			try {
				return JSON.parse(content);
			} catch (e) {
				throw('invalid configuration in ' + fileName);
			}
		});
	};
module.exports = function loadconfig() {
	'use strict';
	var result = {};
	return readAsJSON('package.json').then(function (content) {
		result.package = content;
	}).then(function () {
		return readAsJSON('beamup.json');
	}).then(function (content) {
		result.config = content;
	}).then(function () {
		return result;
	});
};
