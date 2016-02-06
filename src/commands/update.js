/*global module, require*/
var Promise = require('bluebird'),
	path = require('path'),
	readjson = require('../util/readjson'),
	shell = require('shelljs'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	fs = require('fs'),
	readFile = Promise.promisify(fs.readFile),
	aws = require('aws-sdk');
module.exports = function update(options) {
	'use strict';
	if (!shell.test('-e', path.join(options.source, 'claudia.json'))) {
		return Promise.reject('claudia.json does not exist in the source folder');
	}
	return readjson(path.join(options.source, 'claudia.json')).then(function (config) {
		var name = config && config.lambda && config.lambda.name,
			region = config && config.lambda && config.lambda.region;
		if (!name) {
			return Promise.reject('invalid configuration -- lambda.name missing from claudia.json');
		}
		if (!region) {
			return Promise.reject('invalid configuration -- lambda.region missing from claudia.json');
		}
		return Promise.resolve(config.lambda);
	}).then(function (lambdaConfig) {
		var lambda = new aws.Lambda({region: lambdaConfig.region}),
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

