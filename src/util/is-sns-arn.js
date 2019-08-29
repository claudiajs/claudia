module.exports = function isSNSArn(string) {
	'use strict';
	return /^arn:aws[^:]*:sns:[^:]+:[^:]+:[^:]+$/.test(string);
};

