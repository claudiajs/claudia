const loadConfig = require('../util/loadconfig'),
	isRoleArn = require('../util/is-role-arn'),
	isKinesisArn = require('../util/is-kinesis-arn'),
	retry = require('oh-no-i-insist'),
	aws = require('aws-sdk');

module.exports = function addKinesisEventSource(options) {
	'use strict';
	let lambdaConfig,
		lambda,
		iam,
		kinesis;
	const awsDelay = Number(options['aws-delay']) || 5000,
		awsRetries = Number(options['aws-retries']) || 15,
		initServices = function () {
			lambda = new aws.Lambda({region: lambdaConfig.region});
			iam = new aws.IAM({region: lambdaConfig.region});
			kinesis = new aws.Kinesis({region: lambdaConfig.region});
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
		upgradeRolePolicy = function () {
			if (!isRoleArn(lambdaConfig.role) && !options['skip-iam']) {
				return iam.attachRolePolicy({
					RoleName: lambdaConfig.role,
					PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaKinesisExecutionRole'
				}).promise();
			};
		},
		getKinesisArn = function () {
			if (isKinesisArn(options.stream)) {
				return options.stream;
			} else {
				return kinesis.describeStream({
					StreamName: options.stream
				}).promise()
				.then(result => result.StreamDescription.StreamARN);
			}
		},
		addEventSource = function (kinesisArn) {
			const startingPosition = options['starting-position'] || 'LATEST',
				params = {
					FunctionName: lambdaConfig.arn,
					EventSourceArn: kinesisArn,
					StartingPosition: startingPosition,
					StartingPositionTimestamp: options['starting-timestamp'],
					BatchSize: options['batch-size']
				};
			return lambda.createEventSourceMapping(params).promise();
		},
		retriableAddEventSource = function (kinesisArn) {
			return retry(
				() => addEventSource(kinesisArn),
				awsDelay,
				awsRetries,
				failure => failure.code === 'InvalidParameterValueException',
				() => {
					if (!options.quiet) {
						console.log('waiting for IAM role propagation');
					}
				},
				Promise
			);
		};
	if (!options.stream) {
		return Promise.reject('Kinesis stream not specified. please provide it with --stream');
	}
	return readConfig()
		.then(upgradeRolePolicy)
		.then(getKinesisArn)
		.then(retriableAddEventSource);

};
module.exports.doc = {
	description: 'Set up Kinesis Data Stream event triggers',
	priority: 5,
	args: [
		{
			argument: 'stream',
			description: 'Kinesis data stream name or ARN',
			example: 'analytics-events'
		},
		{
			argument: 'batch-size',
			optional: true,
			description: 'The batch size for the Lambda event source mapping',
			example: 50,
			default: 100
		},
		{
			argument: 'starting-position',
			optional: true,
			description: 'The stating position for the event source. Can be LATEST, TRIM_HORIZON or AT_TIMESTAMP. '
				+ ' Check out https://docs.aws.amazon.com/cli/latest/reference/lambda/create-event-source-mapping.html for detailed info on values',
			example: 'AT_TIMESTAMP',
			default: 'LATEST'
		},
		{
			argument: 'starting-timestamp',
			optional: true,
			description: 'The initial timestamp when starting-position is set to AT_TIMESTAMP.'
				+ ' Check out https://docs.aws.amazon.com/cli/latest/reference/lambda/create-event-source-mapping.html for detailed info',
			example: 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)'
		},
		{
			argument: 'skip-iam',
			optional: true,
			description: 'Do not try to modify the IAM role for Lambda to allow Kinesis execution',
			example: 'true'
		},
		{
			argument: 'version',
			optional: true,
			description: 'Alias or numerical version of the lambda function to execute the trigger',
			example: 'production'
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
			argument: 'aws-delay',
			optional: true,
			example: '3000',
			description: 'number of milliseconds betweeen retrying AWS operations if they fail',
			default: '5000'
		},
		{
			argument: 'aws-retries',
			optional: true,
			example: '15',
			description: 'number of times to retry AWS operations if they fail',
			default: '15'
		}
	]
};

