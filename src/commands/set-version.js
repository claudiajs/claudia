/*global module, require*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	markAlias = require('../tasks/mark-alias');
module.exports = function setVersion(options) {
	'use strict';
	var lambdaConfig, lambda;
	if (!options.version) {
		return Promise.reject('version misssing. please provide using --version');
	}

	return loadConfig(options.source, {lambda: {name: true, region: true}}).then(function (config) {
		lambdaConfig = config.lambda;
		lambda = Promise.promisifyAll(new aws.Lambda({region: lambdaConfig.region}), {suffix: 'Promise'});
	}).then(function () {
		return lambda.publishVersionPromise({FunctionName: lambdaConfig.name});
	}).then(function (versionResult) {
		return markAlias(lambdaConfig.name, lambdaConfig.region, versionResult.Version, options.version);
	});
};
