/*global module, require */
var loadConfig = require('../util/loadconfig'),
	Promise = require('bluebird'),
	aws = require('aws-sdk');

module.exports = function addSNSEventSource(options) {
	'use strict';
	var lambdaConfig,
		lambda,
		sns,
		initServices = function () {
			lambda = Promise.promisifyAll(new aws.Lambda({region: lambdaConfig.region}), {suffix: 'Promise'});
			sns = Promise.promisifyAll(new aws.SNS({region: lambdaConfig.region}));
		},
		getLambda = function () {
			return lambda.getFunctionConfigurationPromise({FunctionName: lambdaConfig.name, Qualifier: options.version});
		},
		readConfig = function () {
			return loadConfig(options.source, {lambda: {name: true, region: true}})
				.then(function (config) {
					lambdaConfig = config.lambda;
				}).then(initServices)
				.then(getLambda)
				.then(function (result) {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				});
		},
		addInvokePermission = function () {
			return lambda.addPermissionPromise({
				Action: 'lambda:InvokeFunction',
				FunctionName: lambdaConfig.name,
				Principal: 'sns.amazonaws.com',
				SourceArn: options.topic,
				Qualifier: options.version,
				StatementId: options.topic.split(':').slice(3).join('-')  + '-' + Date.now()
			});
		},
		addSubscription = function () {
			return sns.subscribeAsync({
				Protocol: 'lambda',
				TopicArn: options.topic,
				Endpoint: lambdaConfig.arn
			});
		};
	if (!options.topic) {
		return Promise.reject('SNS topic not specified. please provide it with --topic');
	}
	return readConfig()
		.then(addInvokePermission)
		.then(addSubscription);
};
