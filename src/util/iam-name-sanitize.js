module.exports = function iamNameSanitize(str) {
	'use strict';
	return str && str.replace(/[^a-zA-Z0-9-_]/g, '_');
};
