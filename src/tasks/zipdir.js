const fsUtil = require('../util/fs-util'),
	tmppath = require('../util/tmppath'),
	archiver = require('archiver'),
	fs = require('fs');
module.exports = function zipdir(path) {
	'use strict';
	const targetFile = tmppath('.zip');
	if (!fsUtil.fileExists(path)) {
		return Promise.reject(path + ' does not exist');
	} else if (!fsUtil.isDir(path)) {
		return Promise.reject(path + ' is not a directory');
	}
	return new Promise((resolve, reject) => {
		const archive = archiver.create('zip', {}),
			zipStream = fs.createWriteStream(targetFile);
		zipStream.on('close', () => {
			fsUtil.rmDir(path);
			resolve(targetFile);
		});
		archive.pipe(zipStream);
		archive.directory(path, '');
		archive.on('error', e => reject(e));
		archive.finalize();
	});
};
