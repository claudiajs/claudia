/*global require, module */
var os = require('os'),
	uuid = require('uuid'),
	path = require('path'),
	shell = require('shelljs');

module.exports = function tmppath(ext, generator) {
	'use strict';
	var result;
	generator = generator || uuid.v4;
	ext = ext || '';
	while (!result || shell.test('-e', result))  {
		result = path.join(os.tmpdir(), generator() + ext);
	}
	return result;
};
