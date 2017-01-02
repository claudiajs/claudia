/*global require, exports */
var shell = require('shelljs');
exports.ensureCleanDir = function (dirPath) {
	'use strict';
	shell.rm('-rf', dirPath);
	shell.mkdir(dirPath);
};
exports.rmDir = function (dirPath) {
	'use strict';
	shell.rm('-rf', dirPath);
};
exports.fileExists = function (filePath) {
	'use strict';
	return shell.test('-e', filePath);
};
