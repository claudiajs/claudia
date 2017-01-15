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
		sns = new aws.SNS({ region: awsRegion }),
		events = new aws.CloudWatchEvents({ region: awsRegion }),
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
		};

	if (!newObjects) {
		return Promise.resolve();
	}
	process.chdir(originalWorkingDir);
	if (newObjects.workingdir && fsUtil.isDir(newObjects.workingdir)) {
		fsUtil.rmDir(newObjects.workingdir);
	}

	return Promise.resolve()
	.then(() => {
		if (newObjects.restApi) {
			return apiGatewayPromise.deleteRestApiPromise({
				restApiId: newObjects.restApi
			});
		}
	})
	.then(() => {
		if (newObjects.lambdaFunction) {
			return lambda.deleteFunction({ FunctionName: newObjects.lambdaFunction }).promise();
		}
	})
	.then(() => {
		if (newObjects.lambdaFunction) {
			return logs.deleteLogGroup({ logGroupName: '/aws/lambda/' + newObjects.lambdaFunction }).promise()
			.catch(() => true);
		}
	})
	.then(() => {
		if (newObjects.snsTopic) {
			return sns.deleteTopic({
				TopicArn: newObjects.snsTopic
			}).promise();
		}
	})
	.then(() => {
		if (newObjects.eventRule) {
			return destroyRule(newObjects.eventRule);
		}
	})
	.then(() => {
		if (newObjects.lambdaRole) {
			return destroyRole(newObjects.lambdaRole);
		}
	})
	.then(() => {
		if (newObjects.logGroup) {
			return logs.deleteLogGroup({ logGroupName: newObjects.logGroup }).promise();
		}
	})
	.then(() => {
		if (newObjects.s3Bucket) {
			return destroyBucket(newObjects.s3Bucket);
		}
	})
	.catch(e => console.log('error cleaning up', e.stack || e.message || e));
};
