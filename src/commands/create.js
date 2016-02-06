/*global module, require, setTimeout*/
var Promise = require('bluebird'),
	path = require('path'),
	shell = require('shelljs'),
	aws = require('aws-sdk'),
	loadConfig = require('../tasks/loadconfig'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	fs = require('fs');
module.exports = function create(options) {
	'use strict';
	var source = options.source || shell.pwd(),
		iam = new aws.IAM(),
		lambda = new aws.Lambda({region: options.region}),
		createRole = Promise.promisify(iam.createRole.bind(iam)),
		createFunction = Promise.promisify(lambda.createFunction.bind(lambda)),
		lambdaRolePolicy = {
			'Version': '2012-10-17',
			'Statement': [{
				'Effect': 'Allow',
				'Principal': {
					'Service': 'lambda.amazonaws.com'
				},
				'Action': 'sts:AssumeRole'
			}]
		},
		iamPropagationError = 'The role defined for the function cannot be assumed by Lambda.',
		createLambda = function (zipFile, roleArn, retriesLeft) {
			var tryCreating = function () {
				return createFunction({
					Code: { ZipFile: zipFile },
					FunctionName: options.name,
					Handler: 'main.handler',
					Role: roleArn,
					Runtime: 'nodejs'
				});
			};
			if (!retriesLeft) {
				return Promise.reject('Timeout waiting for AWS IAM to propagate role');
			}
			return new Promise(function (resolve, reject) {
				tryCreating().then(resolve, function (error) {
					if (error && error.cause && error.cause.message == iamPropagationError) {
						setTimeout(function () {
							createLambda(zipFile, roleArn, retriesLeft - 1).then(resolve, reject);
						}, 4000);
					} else {
						reject(error);
					}
				});
			});
		},
		sendLambda = function (roleMetadata) {
			var cwd = shell.pwd(), promise,
				readFile = Promise.promisify(fs.readFile),
				writeFile = Promise.promisify(fs.writeFile);
			shell.cd(source);
			promise = loadConfig(true).
						then(collectFiles).
						then(zipdir).
						then(readFile).
						then(function (fileContents) {
							return createLambda(fileContents, roleMetadata.Role.Arn, 10);
						}).
						then(function (lambdaMetaData) {
							var config = {
								lambda: {
									role: roleMetadata.Role.RoleName,
									name: lambdaMetaData.FunctionName,
									region: options.region
								}
							};
							return writeFile(
								path.join(source, 'beamup.json'),
								JSON.stringify(config, null, 2),
								'utf8'
							).then(function () {
								return Promise.resolve(config);
							});
						});
			promise.finally(function () {
				shell.cd(cwd);
			});
			return promise;
		};
	if (!options.name) {
		return Promise.reject('project name is missing. please specify with --name');
	}
	if (!options.region) {
		return Promise.reject('AWS region is missing. please specify with --region');
	}
	if (shell.test('-e', path.join(source, 'beamup.json'))) {
		return Promise.reject('beamup.json already exists in the source folder');
	}
	if (!shell.test('-e', path.join(source, 'package.json'))) {
		return Promise.reject('package.json does not exist in the source folder');
	}
	return createRole({
		RoleName: options.name + '-executor',
		AssumeRolePolicyDocument: JSON.stringify(lambdaRolePolicy)
	}).then(sendLambda);
};
