module.exports = function validCredentials(creds) {
	'use strict';
	const credsRegex = /^arn:aws:(iam|sts)::(\*|\d{12})?:/;
	return creds === true || ((typeof creds === 'string') && credsRegex.test(creds));
};
