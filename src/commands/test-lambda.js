/*global module, require, Promise*/
var aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	fs = require('../util/fs-promise');
module.exports = function testLambda(options) {
	'use strict';
	var getPayload = function () {
			if (!options.event) {
				return Promise.resolve('');
			} else {
				return fs.readFileAsync(options.event, 'utf-8');
			}
		},
		lambdaConfig;

	return loadConfig(options, {lambda: {name: true, region: true}}).then(function (config) {
		lambdaConfig = config.lambda;
	}).then(getPayload)
	.then(function (payload) {
		var lambda = new aws.Lambda({region: lambdaConfig.region});
		return lambda.invoke({FunctionName: lambdaConfig.name, Payload: payload, Qualifier: options.version}).promise();
	});
};
module.exports.doc = {
	description: 'Execute the lambda function and print out the response',
	priority: 8,
	args: [
		{
			argument: 'event',
			optional: true,
			description: 'Path to a file containing the JSON test event'
		},
		{
			argument: 'version',
			optional: true,
			description: 'A version alias to test',
			default: 'latest version'
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
