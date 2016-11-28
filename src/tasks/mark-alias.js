/*global module, Promise*/
module.exports = function markAlias(functionName, lambda, versionName, versionAlias) {
	'use strict';
	var config = {
			FunctionName: functionName,
			FunctionVersion: versionName,
			Name: versionAlias
		};
	return lambda.updateAlias(config).promise().catch(function (e) {
		if (e && e.code === 'ResourceNotFoundException') {
			return lambda.createAlias(config).promise();
		} else {
			return Promise.reject(e);
		}
	});
};
