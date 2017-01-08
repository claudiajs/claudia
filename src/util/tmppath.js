const os = require('os'),
	uuid = require('uuid'),
	path = require('path'),
	fsUtil = require('./fs-util');

module.exports = function tmppath(ext, generator) {
	'use strict';
	let result;
	generator = generator || uuid.v4;
	ext = ext || '';
	while (!result || fsUtil.fileExists(result))  {
		result = path.join(os.tmpdir(), generator() + ext);
	}
	return result;
};
