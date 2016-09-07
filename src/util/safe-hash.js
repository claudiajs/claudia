/*global module, require*/
var crypto = require('crypto');
/* returns a sha hash of an object, transformed to be safe for an API gateway stage variable */
module.exports = function safeHash(object) {
	'use strict';
	var hash = crypto.createHash('sha256');
	if (typeof object === 'string') {
		hash.update(object, 'utf8');
	} else {
		hash.update(JSON.stringify(object), 'utf8');
	}
	return hash.digest('base64').replace(/\+/g, '-');
};
