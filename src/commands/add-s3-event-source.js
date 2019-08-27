const loadConfig = require('../util/loadconfig'),
	iamNameSanitize = require('../util/iam-name-sanitize'),
	aws = require('aws-sdk');
module.exports = function addS3EventSource(options) {
	'use strict';
	let lambdaConfig,
		awsPartition,
		lambda;
	const ts = Date.now(),
		getLambda = function (config) {
			lambda = new aws.Lambda({region: config.lambda.region});
			lambdaConfig = config.lambda;
			return lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name, Qualifier: options.version}).promise();
		},
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true, role: true}})
				.then(config => {
					lambdaConfig = config;
					return config;
				})
				.then(getLambda)
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					awsPartition = result.FunctionArn.split(':')[1];
					lambdaConfig.version = result.Version;
				});
		},
		addS3AccessPolicy = function () {
			const iam = new aws.IAM({region: lambdaConfig.region});
			return iam.putRolePolicy({
				RoleName: lambdaConfig.role,
				PolicyName: iamNameSanitize(`s3-${options.bucket}-access-${ts}`),
				PolicyDocument: JSON.stringify({
					'Version': '2012-10-17',
					'Statement': [
						{
							'Effect': 'Allow',
							'Action': [
								's3:*'
							],
							'Resource': [
								`arn:${awsPartition}:s3:::${options.bucket}/*`
							]
						}
					]
				})
			}).promise();
		},
		addInvokePermission = function () {
			return lambda.addPermission({
				Action: 'lambda:InvokeFunction',
				FunctionName: lambdaConfig.name,
				Principal: 's3.amazonaws.com',
				SourceArn: `arn:${awsPartition}:s3:::${options.bucket}`,
				Qualifier: options.version,
				StatementId: iamNameSanitize(`${options.bucket}-access-${ts}`)
			}).promise();
		},
		addBucketNotificationConfig = function () {
			const events = options.events ? options.events.split(',') : ['s3:ObjectCreated:*'],
				s3 = new aws.S3({region: lambdaConfig.region, signatureVersion: 'v4'}),
				eventConfig = {
					LambdaFunctionArn: lambdaConfig.arn,
					Events: events
				},
				filterRules = [];
			if (options.prefix) {
				filterRules.push({
					Name: 'prefix',
					Value: options.prefix
				});
			}
			if (options.suffix) {
				filterRules.push({
					Name: 'suffix',
					Value: options.suffix
				});
			}
			if (filterRules.length) {
				eventConfig.Filter = {
					Key: {
						FilterRules: filterRules
					}
				};
			}
			return s3.getBucketNotificationConfiguration({
				Bucket: options.bucket
			}).promise()
			.then(currentConfig => {
				const merged = currentConfig || {};
				if (!merged.LambdaFunctionConfigurations) {
					merged.LambdaFunctionConfigurations = [];
				}
				merged.LambdaFunctionConfigurations.push(eventConfig);
				return s3.putBucketNotificationConfiguration({
					Bucket: options.bucket,
					NotificationConfiguration: merged
				}).promise();
			});
		};

	if (!options.bucket) {
		return Promise.reject('bucket name not specified. please provide it with --bucket');
	}

	return readConfig()
		.then(addS3AccessPolicy)
		.then(addInvokePermission)
		.then(addBucketNotificationConfig);
};

module.exports.doc = {
	description: 'Add a notification event to Lambda when a file is added to a S3 bucket, and set up access permissions',
	priority: 5,
	args: [
		{
			argument: 'bucket',
			description: 'S3 Bucket name which will push notifications to Lambda'
		},
		{
			argument: 'prefix',
			optional: true,
			description: 'Prefix filter for S3 keys that will cause the event',
			example: 'infiles/'
		},
		{
			argument: 'suffix',
			optional: true,
			description: 'Suffix filter for S3 keys that will cause the event',
			example: '.jpg'
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
			argument: 'events',
			optional: true,
			description: 'Comma separated list of event types that trigger the function',
			example: 's3:ObjectCreated:*,s3:ObjectRemoved:*',
			default: 's3:ObjectCreated:*'
		}
	]
};
