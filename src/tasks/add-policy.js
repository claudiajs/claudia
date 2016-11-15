/*global module, __dirname, require */
var path = require('path'),
	fs = require('../util/fs-promise'),
	aws = require('aws-sdk');
module.exports = function addPolicy(policyName, roleName, fileName) {
	'use strict';
	var iam = new aws.IAM();
	fileName = fileName || path.join(__dirname, '..', '..', 'json-templates', policyName + '.json');
	return fs.readFileAsync(fileName, 'utf8').then(
		function (policyContents) {
			return iam.putRolePolicy({
				RoleName: roleName,
				PolicyName: policyName,
				PolicyDocument: policyContents
			}).promise();
		});
};
