/*global require, Promise, console, process*/
const aws = require('aws-sdk'),
	destroyRole = require('../../src/util/destroy-role'),
	fsUtil = require('../../src/util/fs-util'),
	retriableWrap = require('../../src/util/retriable-wrap'),
	awsRegion = require('./test-aws-region'),
	originalWorkingDir = process.cwd();

module.exports = function destroyObjects(newObjects) {
	'use strict';
	const lambda = new aws.Lambda({ region: awsRegion }),
		logs = new aws.CloudWatchLogs({ region: awsRegion }),
		apiGatewayPromise = retriableWrap(new aws.APIGateway({ region: awsRegion })),
		s3 = new aws.S3(),
		iot = new aws.Iot({ region: awsRegion }),
		sns = new aws.SNS({ region: awsRegion }),
		sqs = new aws.SQS({ region: awsRegion }),
		events = new aws.CloudWatchEvents({ region: awsRegion }),
		cognitoIdentityServiceProvider = new aws.CognitoIdentityServiceProvider({ region: awsRegion }),
		destroyRule = function (ruleName) {
			return events.listTargetsByRule({ Rule: ruleName }).promise()
			.then(config => {
				const ids = config.Targets.map(target => target.Id);
				if (ids.length) {
					return events.removeTargets({ Rule: ruleName, Ids: ids }).promise();
				}
			})
			.then(() => events.deleteRule({ Name: ruleName }).promise());
		},
		destroyBucket = function (bucketName) {
			const deleteSingleObject = function (ob) {
				return s3.deleteObject({
					Bucket: bucketName,
					Key: ob.Key
				}).promise();
			};
			return s3.listObjects({Bucket: bucketName}).promise()
			.then(result => Promise.all(result.Contents.map(deleteSingleObject)))
			.then(() => s3.deleteBucket({ Bucket: bucketName }).promise());
		},
		removeRestApi = () => {
			if (newObjects.restApi) {
				return apiGatewayPromise.deleteRestApiPromise({
					restApiId: newObjects.restApi
				});
			}
		},
		removeIotRule = () => {
			if (newObjects.iotTopicRule) {
				return iot.deleteTopicRule({ruleName: newObjects.iotTopicRule}).promise();
			}
		},
		removeLambdaFunction = () => {
			if (newObjects.lambdaFunction) {
				return lambda.deleteFunction({ FunctionName: newObjects.lambdaFunction }).promise();
			}
		},
		removeLambdaLogs = () => {
			if (newObjects.lambdaFunction) {
				return logs.deleteLogGroup({ logGroupName: '/aws/lambda/' + newObjects.lambdaFunction }).promise()
				.catch(() => true);
			}
		},
		removeSnsTopic = () => {
			if (newObjects.snsTopic) {
				return sns.deleteTopic({
					TopicArn: newObjects.snsTopic
				}).promise();
			}
		},
		removeEventRule = () => {
			if (newObjects.eventRule) {
				return destroyRule(newObjects.eventRule);
			}
		},
		removeIamRole = () => {
			if (newObjects.lambdaRole) {
				return destroyRole(newObjects.lambdaRole);
			}
		},
		removeCustomLogs = () => {
			if (newObjects.logGroup) {
				return logs.deleteLogGroup({ logGroupName: newObjects.logGroup }).promise();
			}
		},
		removeS3Bucket = () => {
			if (newObjects.s3Bucket) {
				return destroyBucket(newObjects.s3Bucket);
			}
		},
		removeCognitoPool = () => {
			if (newObjects.userPoolId) {
				return cognitoIdentityServiceProvider.deleteUserPool({ UserPoolId: newObjects.userPoolId }).promise();
			}
		},
		removeSQSQueue = () => {
			if (newObjects.sqsQueueUrl) {
				return sqs.deleteQueue({QueueUrl: newObjects.sqsQueueUrl}).promise();
			}
		};



	if (!newObjects) {
		return Promise.resolve();
	}
	process.chdir(originalWorkingDir);
	if (newObjects.workingdir && fsUtil.isDir(newObjects.workingdir)) {
		fsUtil.rmDir(newObjects.workingdir);
	}

	return Promise.all([
		removeRestApi(),
		removeIotRule(),
		removeLambdaFunction(),
		removeLambdaLogs(),
		removeSnsTopic(),
		removeEventRule(),
		removeIamRole(),
		removeCustomLogs(),
		removeS3Bucket(),
		removeCognitoPool(),
		removeSQSQueue()
	]).catch(e => console.log('error cleaning up', e.stack || e.message || e));
};
