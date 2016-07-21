/*global module */
module.exports = function validAuthType(type) {
	'use strict';
	var authTypes = ['AWS_IAM', 'NONE'];
	return (authTypes.indexOf(type) >= 0);
};
