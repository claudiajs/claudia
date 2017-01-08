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
	return shell.cp('-r', from, to);
};
exports.recursiveList = function (dirPath) {
	'use strict';
	return shell.ls('-R', dirPath);
};
