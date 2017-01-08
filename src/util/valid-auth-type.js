module.exports = function validAuthType(type) {
	'use strict';
	const authTypes = ['AWS_IAM', 'NONE', 'CUSTOM'];
	return (authTypes.indexOf(type) >= 0);
};
