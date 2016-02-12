/*global module, require*/
var Promise = require('bluebird'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	fs = require('fs'),
	readFile = Promise.promisify(fs.readFile),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig');
module.exports = function update(options) {
	'use strict';
	return loadConfig(options.source, {lambda: {name: true, region: true}}).then(function (config) {
		var lambdaConfig = config.lambda,
			lambda = new aws.Lambda({region: lambdaConfig.region}),
			updateLambda = function (fileContents) {
				var call = Promise.promisify(lambda.updateFunctionCode.bind(lambda));
				return call({FunctionName: lambdaConfig.name, ZipFile: fileContents, Publish: true});
			};
		return collectFiles(options.source).
				then(zipdir).
				then(readFile).
				then(updateLambda);
	});
};

