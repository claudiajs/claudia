module.exports = function lambdaNameSanitize(str) {
	'use strict';
	return str && str.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9-_]/g, '_').substr(0, 140);
};
