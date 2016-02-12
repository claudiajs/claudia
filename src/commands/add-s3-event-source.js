/*global module, require, __dirname */
var loadConfig = require('../util/loadconfig'),
	readJSON = require('../util/readjson'),
	Promise = require('bluebird'),
	path = require('path'),
	aws = require('aws-sdk');
module.exports = function addS3EventSource(options) {
	'use strict';
	var lambdaConfig,
		getLambda = function (config) {
			var lambda = new aws.Lambda({region: config.lambda.region}),
				getFunctionConfiguration = Promise.promisify(lambda.getFunctionConfiguration.bind(lambda));
			lambdaConfig = config.lambda;
			return getFunctionConfiguration({FunctionName: lambdaConfig.name /* + qualifier */});
		},
		readConfig = function () {
			return loadConfig(options.source, {lambda: {name: true, region: true, role: true}})
				.then(function (config) {
					lambdaConfig = config;
					return config;
				}).then(getLambda)
				.then(function (result) {
					lambdaConfig.arn = result.FunctionArn;
				});
		},
		addS3AccessPolicy = function () {
			return readJSON(path.join(__dirname, '..', '..', 'json-templates', 's3-bucket-access.json'))
				.then(function (policy) {
					policy.Statement[0].Resource[0] = policy.Statement[0].Resource[0].replace(/BUCKET_NAME/g, options.bucket);
					return JSON.stringify(policy);
				}).then(function (policyContents) {
					var iam = new aws.IAM(),
					putRolePolicy = Promise.promisify(iam.putRolePolicy.bind(iam));
					return putRolePolicy({
						RoleName: lambdaConfig.role,
						PolicyName: 's3-' + options.bucket + '-access',
						PolicyDocument: policyContents
					});
				});
		},

		addInvokePermission = function () {
			var lambda = new aws.Lambda({region: lambdaConfig.region}),
			addPermission = Promise.promisify(lambda.addPermission.bind(lambda));
			return addPermission({
				Action: 'lambda:InvokeFunction',
				FunctionName: lambdaConfig.name,
				Principal: 's3.amazonaws.com',
				SourceArn: 'arn:aws:s3:::' + options.bucket,
				//Qualifier: lambdaF.Version,
				StatementId:  options.bucket  + '-access' // + lambdaF.Version,
			});
		},
		addBucketNotificationConfig = function () {
			var s3 = Promise.promisifyAll(new aws.S3()),
				notificationConfig = {
					LambdaFunctionConfigurations: [{
						LambdaFunctionArn: lambdaConfig.arn,
						Events: ['s3:ObjectCreated:*']
					}]
				};
			return s3.putBucketNotificationConfigurationAsync({
				Bucket: options.bucket,
				NotificationConfiguration: notificationConfig
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
