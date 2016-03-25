/*global module, require*/
var Promise = require('bluebird'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	fs = require('fs'),
	path = require('path'),
	readFile = Promise.promisify(fs.readFile),
	aws = require('aws-sdk'),
	shell = require('shelljs'),
	markAlias = require('../tasks/mark-alias'),
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	loadConfig = require('../util/loadconfig');
module.exports = function update(options) {
	'use strict';
	var lambda, lambdaConfig, apiConfig, updateResult,
		updateLambda = function (fileContents) {
			return lambda.updateFunctionCodePromise({FunctionName: lambdaConfig.name, ZipFile: fileContents, Publish: true});
		};
	options = options || {};
	if (!options.source) {
		options.source = shell.pwd();
	}
	return loadConfig(options, {lambda: {name: true, region: true}}).then(function (config) {
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
			return rebuildWebApi(lambdaConfig.name, options.version || 'latest', apiConfig.id, apiDef, lambdaConfig.region, options.verbose);
		}
	}).then(function () {
		return updateResult;
	});
};
module.exports.doc = {
	description: 'Deploy a new version of the Lambda function using project files, update any associated web APIs',
	priority: 2,
	args: [
		{
			argument: 'version',
			optional: true,
			description: 'A version alias to automatically assign to the new deployment',
			example: 'development'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			default: 'current directory'
		},
		{
			argument: 'config',
			optional: true,
			description: 'Config file containing the resource names',
			default: 'claudia.json'
		}
	]
};
