module.exports = function trimSlash(path) {
	'use strict';
	return /\/$/.test(path) ? path.substr(0, path.length - 1) : path;
};
