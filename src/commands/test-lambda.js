/*global module, require*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	fs = Promise.promisifyAll(require('fs'));
module.exports = function testLambda(options) {
	'use strict';
	return loadConfig(options.source, {lambda: {name: true, region: true}}).then(function (config) {
		var lambdaConfig = config.lambda,
			lambda = new aws.Lambda({region: lambdaConfig.region}),
			invokeLambda = Promise.promisify(lambda.invoke.bind(lambda)),
			getPayload = function () {
				if (!options.event) {
					return Promise.resolve('');
				} else {
					return fs.readFileAsync(options.event, 'utf-8');
				}
			};
		return getPayload().then(function (payload) {
			return invokeLambda({FunctionName: lambdaConfig.name, Payload: payload});
		});
	});
};
