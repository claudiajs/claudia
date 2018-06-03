const fs = require('fs'),
	gunzip = require('gunzip-maybe'),
	tarStream = require('tar-fs');

module.exports = function extractTar(archive, dir) {
	'use strict';
	return new Promise((resolve, reject) => {
		const extractStream = tarStream.extract(dir);
		extractStream.on('finish', () => resolve(dir));
		extractStream.on('error', reject);
		fs.createReadStream(archive).pipe(gunzip()).pipe(extractStream);
	});
};
