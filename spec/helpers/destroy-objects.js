/*global beforeEach, require*/

beforeEach(function () {
	'use strict';
	var aws = require('aws-sdk'),
		Promise = require('bluebird'),
		shell = require('shelljs'),
		awsRegion = 'us-east-1';

	this.destroyObjects = function (newObjects) {
		var lambda = new aws.Lambda({region: awsRegion}),
			logs = new aws.CloudWatchLogs({region: awsRegion}),
			iam = Promise.promisifyAll(new aws.IAM()),
			deleteFunction = Promise.promisify(lambda.deleteFunction.bind(lambda)),
			deleteLogGroup = Promise.promisify(logs.deleteLogGroup.bind(logs)),
			s3 = Promise.promisifyAll(new aws.S3()),
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


		if (newObjects.workingdir && shell.test('-e', newObjects.workingdir)) {
			shell.rm('-rf', newObjects.workingdir);
		}

		if (!newObjects) {
			return Promise.resolve();
		}
		return Promise.resolve().then(function () {
			if (newObjects.lambdaFunction) {
				return deleteFunction({FunctionName: newObjects.lambdaFunction});
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
