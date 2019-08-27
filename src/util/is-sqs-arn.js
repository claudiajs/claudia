module.exports = function isSQSArn(string) {
	'use strict';
	return /^arn:aws[^:]*:sqs:[^:]+:[^:]+:[^:]+$/.test(string);
};

