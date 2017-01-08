const loadConfig = require('../util/loadconfig'),
	aws = require('aws-sdk');

module.exports = function addSNSEventSource(options) {
	'use strict';
	let lambdaConfig,
		lambda,
		sns;
	const initServices = function () {
			lambda = new aws.Lambda({region: lambdaConfig.region});
			sns = new aws.SNS({region: lambdaConfig.region});
		},
		getLambda = () => lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name, Qualifier: options.version}).promise(),
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true}})
				.then(config => {
					lambdaConfig = config.lambda;
				})
				.then(initServices)
				.then(getLambda)
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				});
		},
		addInvokePermission = function () {
			return lambda.addPermission({
				Action: 'lambda:InvokeFunction',
				FunctionName: lambdaConfig.name,
				Principal: 'sns.amazonaws.com',
				SourceArn: options.topic,
				Qualifier: options.version,
				StatementId: options.topic.split(':').slice(3).join('-')  + '-' + Date.now()
			}).promise();
		},
		addSubscription = function () {
			return sns.subscribe({
				Protocol: 'lambda',
				TopicArn: options.topic,
				Endpoint: lambdaConfig.arn
			}).promise();
		};
	if (!options.topic) {
		return Promise.reject('SNS topic not specified. please provide it with --topic');
	}
	return readConfig()
		.then(addInvokePermission)
		.then(addSubscription);
};
module.exports.doc = {
	description: 'Add a notification event to Lambda when a message is published on a SNS topic',
	priority: 5,
	args: [
		{
			argument: 'topic',
			description: 'the ARN of the SNS topic'
		},
		{
			argument: 'version',
			optional: true,
			description: 'Bind to a particular version',
			example: 'production',
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
