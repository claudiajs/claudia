/*global module, require*/
var Promise = require('bluebird'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	fs = require('fs'),
	path = require('path'),
	readFile = Promise.promisify(fs.readFile),
	aws = require('aws-sdk'),
	markAlias = require('../tasks/mark-alias'),
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	loadConfig = require('../util/loadconfig');
module.exports = function update(options) {
	'use strict';
	var lambda, lambdaConfig, apiConfig, updateResult,
		updateLambda = function (fileContents) {
			return lambda.updateFunctionCodePromise({FunctionName: lambdaConfig.name, ZipFile: fileContents, Publish: true});
		};
	return loadConfig(options.source, {lambda: {name: true, region: true}}).then(function (config) {
		lambdaConfig = config.lambda;
		apiConfig = config.api;
		lambda = Promise.promisifyAll(new aws.Lambda({region: lambdaConfig.region}), {suffix: 'Promise'});
	}).then(function () {
		return collectFiles(options.source);
	}).then(zipdir)
	.then(readFile)
	.then(updateLambda)
	.then(function (result) {
		updateResult = result;
		return result;
	}).then(function (result) {
		if (options.version) {
			return markAlias(result.FunctionName, lambdaConfig.region, result.Version, options.version);
		}
	}).then(function () {
		var apiModule, apiDef;
		if (apiConfig && apiConfig.id && apiConfig.module) {
			apiModule = require(path.join(options.source, apiConfig.module));
			apiDef = apiModule.apiConfig();
			return rebuildWebApi(lambdaConfig.name, options.version || 'latest', apiConfig.id, apiDef, lambdaConfig.region);
		}
	}).then(function () {
		return updateResult;
	});
};

