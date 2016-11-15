/*global beforeEach, require*/

beforeEach(function () {
	'use strict';
	var aws = require('aws-sdk'),
		Promise = require('bluebird'),
		destroyRole = require('../../src/util/destroy-role'),
		shell = require('shelljs'),
		retriableWrap = require('../../src/util/retriable-wrap'),
		awsRegion = 'us-east-1',
		cwd = shell.pwd();

	this.destroyObjects = function (newObjects) {
		var lambda = new aws.Lambda({region: awsRegion}),
			logs = new aws.CloudWatchLogs({region: awsRegion}),
			apiGatewayPromise = retriableWrap(new aws.APIGateway({region: awsRegion})),
			s3 = Promise.promisifyAll(new aws.S3()),
			sns = Promise.promisifyAll(new aws.SNS({region: awsRegion})),
			events = Promise.promisifyAll(new aws.CloudWatchEvents({region: awsRegion})),
			destroyRule = function (ruleName) {
				return events.listTargetsByRuleAsync({Rule: ruleName}).then(function (config) {
					var ids = config.Targets.map(function (target) {
						return target.Id;
					});
					if (ids.length) {
						return events.removeTargetsAsync({Rule: ruleName, Ids: ids });
					}
				}).then(function () {
					return events.deleteRuleAsync({Name: ruleName});
				});
			},
			destroyBucket = function (bucketName) {
				var deleteSingleObject = function (ob) {
					return s3.deleteObjectAsync({
						Bucket: bucketName,
						Key: ob.Key
					});
				};
				return s3.listObjectsAsync({Bucket: bucketName}).then(function (result) {
					return Promise.map(result.Contents, deleteSingleObject);
				}).then(function () {
					return s3.deleteBucketAsync({Bucket: bucketName});
				});
			};

		if (!newObjects) {
			return Promise.resolve();
		}
		shell.cd(cwd);
		if (newObjects.workingdir && shell.test('-e', newObjects.workingdir)) {
			shell.rm('-rf', newObjects.workingdir);
		}

		return Promise.resolve().then(function () {
			if (newObjects.restApi) {
				return apiGatewayPromise.deleteRestApiPromise({
					restApiId: newObjects.restApi
				});
			}
		}).then(function () {
			if (newObjects.lambdaFunction) {
				return lambda.deleteFunction({FunctionName: newObjects.lambdaFunction}).promise();
			}
		}).then(function () {
			if (newObjects.lambdaFunction) {
				return logs.deleteLogGroup({logGroupName: '/aws/lambda/' + newObjects.lambdaFunction}).promise().catch(function () {
					return true;
				});
			}
		}).then(function () {
			if (newObjects.snsTopic) {
				return sns.deleteTopicAsync({
					TopicArn: newObjects.snsTopic
				});
			}
		}).then(function () {
			if (newObjects.eventRule) {
				return destroyRule(newObjects.eventRule);
			}
		}).then(function () {
			if (newObjects.lambdaRole) {
				return destroyRole(newObjects.lambdaRole);
			}
		}).then(function () {
			if (newObjects.logGroup) {
				return logs.deleteLogGroup({logGroupName: newObjects.logGroup}).promise();
			}
		}).then(function () {
			if (newObjects.s3Bucket) {
				return destroyBucket(newObjects.s3Bucket);
			}
		});
	};
});
