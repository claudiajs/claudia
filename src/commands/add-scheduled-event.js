/*global module, require */
var loadConfig = require('../util/loadconfig'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs')),
	aws = require('aws-sdk');

module.exports = function addScheduledEvent(options) {
	'use strict';
	var lambdaConfig,
		lambda,
		events,
		eventData,
		ruleArn,
		initServices = function () {
			lambda = Promise.promisifyAll(new aws.Lambda({region: lambdaConfig.region}), {suffix: 'Promise'});
			events = Promise.promisifyAll(new aws.CloudWatchEvents({region: lambdaConfig.region}));
		},
		getLambda = function () {
			return lambda.getFunctionConfigurationPromise({FunctionName: lambdaConfig.name, Qualifier: options.version});
		},
		readConfig = function () {
			return loadConfig(options.source, {lambda: {name: true, region: true, role: true}})
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
				Principal: 'events.amazonaws.com',
				SourceArn: ruleArn,
				Qualifier: options.version,
				StatementId:  options.name  + '-access-' + Date.now()
			});
		},
		createRule = function () {
			return events.putRuleAsync({
				Name: options.name,
				ScheduleExpression: options.schedule
			});
		},
		addRuleTarget = function () {
			return events.putTargetsAsync({
				Rule: options.name,
				Targets: [
					{
						Arn: lambdaConfig.arn,
						Id: lambdaConfig.name + '-' + options.version + '-' + Date.now(),
						Input: eventData
					}
				]
			});
		};
	if (!options.event) {
		return Promise.reject('event file not specified. please provide it with --event');
	}
	if (!options.name) {
		return Promise.reject('event name not specified. please provide it with --name');
	}
	if (!options.schedule) {
		return Promise.reject('event schedule not specified. please provide it with --schedule');
	}
	return fs.readFileAsync(options.event, 'utf8')
		.then(function (contents) {
			eventData = contents;
		}).then(readConfig)
		.then(createRule)
		.then(function (eventResult) {
			ruleArn = eventResult.RuleArn;
		}).then(addInvokePermission)
		.then(addRuleTarget);
};
