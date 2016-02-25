/*global module, require */
var path = require('path');
module.exports = function pathSplitter(pathString) {
	'use strict';
	var parent, pathPart;
	if (pathString.indexOf('/') === 0) {
		pathString = pathString.substring(1);
	}
	if (pathString === '') {
		return { parentPath: '', pathPart: '' };
	}
	parent = path.dirname(pathString);
	if (parent === '.') {
		parent = '';
	}
	pathPart = path.basename(pathString);
	return { parentPath: parent, pathPart: pathPart};
};
