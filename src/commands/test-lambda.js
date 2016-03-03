/*global module, require*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	fs = Promise.promisifyAll(require('fs'));
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
		var lambda = new aws.Lambda({region: lambdaConfig.region}),
			invokeLambda = Promise.promisify(lambda.invoke.bind(lambda));
		return invokeLambda({FunctionName: lambdaConfig.name, Payload: payload});
	});
};
