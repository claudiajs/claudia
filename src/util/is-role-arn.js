module.exports = function isRoleArn(string) {
	'use strict';
	return /^arn:aws:iam:.*:role\/[^:]+$/.test(string);
};

