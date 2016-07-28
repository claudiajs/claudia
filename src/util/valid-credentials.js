/*global module */
module.exports = function validCredentials(type) {
	'use strict';
	var credsRegex = /arn:aws:(iam|sts)::(\d{12})?:(.*)/;
	return credsRegex.test(type);
};
