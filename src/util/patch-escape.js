module.exports = function patchEscape(str) {
	'use strict';
	return str.replace(/\//g, '~1');
};
