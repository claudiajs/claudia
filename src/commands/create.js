/*global module, require, __dirname */
var Promise = require('bluebird'),
	path = require('path'),
	shell = require('shelljs'),
	aws = require('aws-sdk'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	addPolicy = require('../tasks/add-policy'),
	fs = require('fs');
module.exports = function create(options) {
	'use strict';
	var source = options.source || shell.pwd(),
		iam = new aws.IAM(),
		lambda = new aws.Lambda({region: options.region}),
		createRole = Promise.promisify(iam.createRole.bind(iam)),
		createFunction = Promise.promisify(lambda.createFunction.bind(lambda)),
		readFile = Promise.promisify(fs.readFile),
		writeFile = Promise.promisify(fs.writeFile),
		roleMetadata,
		validationError = function () {
			if (!options.name) {
				return 'project name is missing. please specify with --name';
			}
			if (!options.region) {
				return 'AWS region is missing. please specify with --region';
			}
			if (!options.handler) {
				return 'Lambda handler is missing. please specify with --handler';
			}
			if (shell.test('-e', path.join(source, 'claudia.json'))) {
				return 'claudia.json already exists in the source folder';
			}
			if (!shell.test('-e', path.join(source, 'package.json'))) {
				return 'package.json does not exist in the source folder';
			}
		},
		createLambda = function (zipFile, roleArn, retriesLeft) {
			var functionMeta = {
				Code: { ZipFile: zipFile },
				FunctionName: options.name,
				Handler: 'main.handler',
				Role: roleArn,
				Runtime: 'nodejs',
				Publish: true
			},
			iamPropagationError = 'The role defined for the function cannot be assumed by Lambda.';
			if (!retriesLeft) {
				return Promise.reject('Timeout waiting for AWS IAM to propagate role');
			}
			return createFunction(functionMeta).catch(function (error) {
				if (error && error.cause && error.cause.message == iamPropagationError) {
					return Promise.delay(2000).then(function () {
						return createLambda(zipFile, roleArn, retriesLeft - 1);
					});
				} else {
					return Promise.reject(error);
				}
			});
		},
		saveConfig = function (lambdaMetaData) {
			var config = {
				lambda: {
					role: roleMetadata.Role.RoleName,
					name: lambdaMetaData.FunctionName,
					region: options.region
				}
			};
			return writeFile(
					path.join(source, 'claudia.json'),
					JSON.stringify(config, null, 2),
					'utf8'
					).then(function () {
				return config;
			});
		};
	if (validationError()) {
		return Promise.reject(validationError());
	}
	return readFile(path.join(__dirname, '..', '..', 'json-templates',  'lambda-exector-policy.json'), 'utf8')
	.then(function (lambdaRolePolicy) {
		return createRole({
			RoleName: options.name + '-executor',
			AssumeRolePolicyDocument: lambdaRolePolicy
		});
	}).then(function (result) {
		roleMetadata = result;
	}).then(function () {
		return addPolicy('log-writer', options.name + '-executor');
	}).then(function () {
		return collectFiles(source);
	}).then(zipdir).
	then(readFile).
	then(function (fileContents) {
		return createLambda(fileContents, roleMetadata.Role.Arn, 10);
	}).
	then(saveConfig);
};
