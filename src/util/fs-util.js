const shell = require('shelljs'),
	fs = require('fs');
exports.ensureCleanDir = function (dirPath) {
	'use strict';
	shell.rm('-rf', dirPath);
	shell.mkdir('-p', dirPath);
};
exports.rmDir = function (dirPath) {
	'use strict';
	shell.rm('-rf', dirPath);
};
exports.fileExists = function (filePath) {
	'use strict';
	return shell.test('-e', filePath);
};
exports.isDir = function (filePath) {
	'use strict';
	return shell.test('-d', filePath);
};
exports.isFile = function (filePath) {
	'use strict';
	return shell.test('-f', filePath);
};
exports.copy = function (from, to) {
	'use strict';
	shell.cp('-r', from, to);
	return Promise.resolve();
};
exports.recursiveList = function (dirPath) {
	'use strict';
	return shell.ls('-R', dirPath);
};
exports.copyFile = function (fromFile, toFile) {
	'use strict';
	const readStream = fs.createReadStream(fromFile);
	readStream.pipe(fs.createWriteStream(toFile));
	return new Promise((resolve, reject) => {
		readStream.once('error', (err) => reject(err));
		readStream.once('end', () => resolve());
	});
};
exports.copyAndReplaceInFile = function (searchFor, replaceWith, fromFile, toFile) {
	'use strict';
	const readStream = fs.createReadStream(fromFile, 'utf8'),
		writeStream = fs.createWriteStream(toFile);
	let fileContents = '';
	readStream.once('data', (chunk) => {
		fileContents += chunk.toString().replace(searchFor, replaceWith);
		writeStream.write(fileContents);
	});
	return new Promise((resolve, reject) => {
		readStream.once('error', (err) => reject(err));
		readStream.once('end', () => {
			writeStream.end();
			resolve();
		});
	});
};
