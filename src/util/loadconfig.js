/*global require, module */
var	path = require('path'),
	readjson = require('../util/readjson'),
	shell = require('shelljs'),
	Promise = require('bluebird');

module.exports = function loadConfig(sourceDir, validate) {
	'use strict';
	sourceDir = sourceDir || shell.cwd();
	if (!shell.test('-e', path.join(sourceDir, 'claudia.json'))) {
		return Promise.reject('claudia.json does not exist in the source folder');
	}
	return readjson(path.join(sourceDir, 'claudia.json')).then(function (config) {
		var name = config && config.lambda && config.lambda.name,
			region = config && config.lambda && config.lambda.region,
			role = config && config.lambda && config.lambda.role;
		if (validate.lambda && validate.lambda.name && !name) {
			return Promise.reject('invalid configuration -- lambda.name missing from claudia.json');
		}
		if (validate.lambda && validate.lambda.region && !region) {
			return Promise.reject('invalid configuration -- lambda.region missing from claudia.json');
		}
		if (validate.lambda && validate.lambda.role && !role) {
			return Promise.reject('invalid configuration -- lambda.role missing from claudia.json');
		}
		return Promise.resolve(config);
	});
};
