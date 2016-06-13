/*global module, __dirname, require */
var path = require('path'),
	fs = require('fs'),
	Promise = require('bluebird'),
	aws = require('aws-sdk');
module.exports = function addPolicy(policyName, roleName, fileName) {
	'use strict';
	var iam = new aws.IAM(),
		readFile = Promise.promisify(fs.readFile),
		putRolePolicy = Promise.promisify(iam.putRolePolicy.bind(iam));
	fileName = fileName || path.join(__dirname, '..', '..', 'json-templates', policyName + '.json');
	return readFile(fileName, 'utf8').then(
		function (policyContents) {
			return putRolePolicy({
				RoleName: roleName,
				PolicyName: policyName,
				PolicyDocument: policyContents
			});
		});
};
