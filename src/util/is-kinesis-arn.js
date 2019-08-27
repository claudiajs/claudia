module.exports = function isKinesisArn(string) {
	'use strict';
	return /^arn:aws[^:]*:kinesis:[^:]+:[^:]+:stream\/[^:]+$/.test(string);
};

