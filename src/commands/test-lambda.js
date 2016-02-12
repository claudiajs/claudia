/*global module, require*/
var Promise = require('bluebird'),
	aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig');
module.exports = function testLambda(options) {
	'use strict';
	return loadConfig(options.source, {lambda: {name: true, region: true}}).then(function (config) {
		var lambdaConfig = config.lambda,
			lambda = new aws.Lambda({region: lambdaConfig.region}),
			invokeLambda = Promise.promisify(lambda.invoke.bind(lambda));
		return invokeLambda({FunctionName: lambdaConfig.name});
	});
};
