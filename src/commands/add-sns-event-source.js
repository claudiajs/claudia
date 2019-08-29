const loadConfig = require('../util/loadconfig'),
	fsPromise = require('../util/fs-promise'),
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
		readPolicy = function () {
			if (options['filter-policy-file']) {
				return fsPromise.readFileAsync(options['filter-policy-file'], 'utf8');
			} else {
				return Promise.resolve(options['filter-policy']);
			}
		},
		addSubscription = function () {
			return readPolicy()
			.then(policy => {
				const params = {
					Protocol: 'lambda',
					TopicArn: options.topic,
					Endpoint: lambdaConfig.arn
				};
				if (policy) {
					params.Attributes = {FilterPolicy: policy};
				}
				return params;
			})
			.then(params => sns.subscribe(params).promise());
		};
	if (!options.topic) {
		return Promise.reject('SNS topic not specified. please provide it with --topic');
	}
	if (options['filter-policy'] && options['filter-policy-file']) {
		return Promise.reject('Cannot use both filter-policy and filter-policy-file. Specify only one.');
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
		},
		{
			argument: 'filter-policy',
			optional: true,
			description: 'JSON filter policy for the subscription',
			example: '{"payment-type": ["card"]}'
		},
		{
			argument: 'filter-policy-file',
			optional: true,
			example: 'sns-filter-policy.json',
			description: 'name of a file containing the JSON filter policy for the subscription'
		}
	]
};
