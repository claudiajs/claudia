const shell = require('shelljs');
exports.ensureCleanDir = function (dirPath) {
	'use strict';
	shell.rm('-rf', dirPath);
	shell.mkdir('-p', dirPath);
};
exports.rmDir = function (dirPath) {
	'use strict';
	shell.rm('-rf', dirPath);
};
exports.renameFile = function (currentFilePath, newFilePath) {
	'use strict';
	shell.mv(currentFilePath, newFilePath);
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
exports.makeDir = function (dirPath) {
	'use strict';
	shell.mkdir('-p', dirPath);
	return Promise.resolve();
};
