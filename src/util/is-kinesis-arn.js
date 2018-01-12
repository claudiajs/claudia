module.exports = function isRoleArn(string) {
	'use strict';
	return /^arn:aws:kinesis:[^:]+:[^:]+:stream\/[^:]+$/.test(string);
};

