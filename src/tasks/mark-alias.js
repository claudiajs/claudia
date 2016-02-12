/*global require, module*/
var Promise = require('bluebird'),
	aws = require('aws-sdk');
module.exports = function markAlias(functionName, region, versionName, versionAlias) {
	'use strict';
	var lambda = Promise.promisifyAll(new aws.Lambda({region: region}), {suffix: 'Promise'}),
		config = {
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
