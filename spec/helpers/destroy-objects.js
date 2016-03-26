/*global beforeEach, require*/

beforeEach(function () {
	'use strict';
	var aws = require('aws-sdk'),
		Promise = require('bluebird'),
		shell = require('shelljs'),
		retriableWrap = require('../../src/util/wrap'),
		awsRegion = 'us-east-1';

	this.destroyObjects = function (newObjects) {
		var lambda = new aws.Lambda({region: awsRegion}),
			logs = new aws.CloudWatchLogs({region: awsRegion}),
			apiGateway = retriableWrap('apiGateway', Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), false),
			iam = Promise.promisifyAll(new aws.IAM()),
			deleteFunction = Promise.promisify(lambda.deleteFunction.bind(lambda)),
			deleteLogGroup = Promise.promisify(logs.deleteLogGroup.bind(logs)),
			s3 = Promise.promisifyAll(new aws.S3()),
			sns = Promise.promisifyAll(new aws.SNS({region: awsRegion})),
			events = Promise.promisifyAll(new aws.CloudWatchEvents({region: awsRegion})),
			destroyRole = function (roleName) {
				var deleteSinglePolicy = function (policyName) {
					return iam.deleteRolePolicyAsync({
						PolicyName: policyName,
						RoleName: roleName
					});
				};
				return iam.listRolePoliciesAsync({RoleName: roleName}).then(function (result) {
					return Promise.map(result.PolicyNames, deleteSinglePolicy);
				}).then(function () {
					return iam.deleteRoleAsync({RoleName: roleName});
				});
			},
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

		if (newObjects.workingdir && shell.test('-e', newObjects.workingdir)) {
			shell.rm('-rf', newObjects.workingdir);
		}

		return Promise.resolve().then(function () {
			if (newObjects.restApi) {
				return apiGateway.deleteRestApiAsync({
					restApiId: newObjects.restApi
				});
			}
		}).then(function () {
			if (newObjects.lambdaFunction) {
				return deleteFunction({FunctionName: newObjects.lambdaFunction});
			}
		}).then(function () {
			if (newObjects.lambdaFunction) {
				return deleteLogGroup({logGroupName: '/aws/lambda/' + newObjects.lambdaFunction}).catch(function () {
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
				return deleteLogGroup({logGroupName: newObjects.logGroup});
			}
		}).then(function () {
			if (newObjects.s3Bucket) {
				return destroyBucket(newObjects.s3Bucket);
			}
		});
	};
});
