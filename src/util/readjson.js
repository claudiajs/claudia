const fsPromise = require('./fs-promise'),
	fsUtil = require('./fs-util');
module.exports = function readJSON(fileName) {
	'use strict';
	if (!fileName) {
		return Promise.reject('file name not provided');
	}
	if (!fsUtil.fileExists(fileName)) {
		return Promise.reject(fileName + ' is missing');
	}
	return fsPromise.readFileAsync(fileName, {encoding: 'utf8'})
	.then(content => {
		try {
			return JSON.parse(content);
		} catch (e) {
			throw 'invalid configuration in ' + fileName;
		}
	});
};
