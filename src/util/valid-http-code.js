/*global module */
module.exports = function validHttpCode(code) {
	'use strict';
	if (isNaN(code) || !code) {
		return false;
	}
	if (String(parseInt(code)) !== String(code)) {
		return false;
	}
	return code > 199 && code < 600;
};
