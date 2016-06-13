/*global require, module*/
var Promise = require('bluebird');
module.exports = function markAlias(functionName, lambda, versionName, versionAlias) {
	'use strict';
	var config = {
			FunctionName: functionName,
			FunctionVersion: versionName,
			Name: versionAlias
		};
	return lambda.updateAliasPromise(config).catch(function (e) {
		if (e && e.code === 'ResourceNotFoundException') {
			return lambda.createAliasPromise(config);
		} else {
			return Promise.reject(e);
		}
	});
};
