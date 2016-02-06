/*global module, require*/
var shell = require('shelljs'),
	fs = require('fs'),
	Promise = require('bluebird'),
	readFile = Promise.promisify(fs.readFile);
module.exports = function readJSON(fileName) {
	'use strict';
	if (!fileName) {
		return Promise.reject('file name not provided');
	}
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

