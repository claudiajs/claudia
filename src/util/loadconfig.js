/*global require, module, Promise */
var	path = require('path'),
	readjson = require('../util/readjson'),
	shell = require('shelljs');

module.exports = function loadConfig(options, validate) {
	'use strict';
	var sourceDir = shell.pwd().toString(),
		fileName,
		configMissingError = function () {
			if (options && options.config) {
				return options.config + ' does not exist';
			}
			return 'claudia.json does not exist in the source folder';
		};

	validate = validate || {};
	if (typeof options === 'string') {
		sourceDir = options;
	} else if (options && options.source) {
		sourceDir = options.source;
	}
	fileName = (options && options.config) ||
		path.join(sourceDir, 'claudia.json');

	if (!shell.test('-e', fileName)) {
		return Promise.reject(configMissingError());
	}
	return readjson(fileName).then(function (config) {
		var name = config && config.lambda && config.lambda.name,
			region = config && config.lambda && config.lambda.region,
			role = config && config.lambda && config.lambda.role;
		if (validate.lambda && validate.lambda.name && !name) {
			return Promise.reject('invalid configuration -- lambda.name missing from ' + path.basename(fileName));
		}
		if (validate.lambda && validate.lambda.region && !region) {
			return Promise.reject('invalid configuration -- lambda.region missing from claudia.json');
		}
		if (validate.lambda && validate.lambda.role && !role) {
			return Promise.reject('invalid configuration -- lambda.role missing from claudia.json');
		}
		return config;
	});
};
