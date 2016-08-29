/*global module */
module.exports = function validAuthType(type) {
	'use strict';
	var authTypes = ['AWS_IAM', 'NONE', 'CUSTOM', 'COGNITO_USER_POOLS'];
	return (authTypes.indexOf(type) >= 0);
};
