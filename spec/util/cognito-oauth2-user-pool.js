/*global require */
/*eslint "strict": ["error", "global"] */
'use strict';
const aws = require('aws-sdk'),
	awsRegion = require('./test-aws-region'),
	getOwnerInfo = require('../../src/tasks/get-owner-info'),
	userPoolName = 'test-user-pool-' + Date.now();

let userPoolId, userPoolArn, idToken;

module.exports.create = function create() {
	const cognitoIdentityServiceProvider = new aws.CognitoIdentityServiceProvider({ region: awsRegion });
	return cognitoIdentityServiceProvider.createUserPool({
		PoolName: userPoolName,
		Schema: [
			{
				'AttributeDataType': 'String',
				'DeveloperOnlyAttribute': false,
				'Mutable': false,
				'Name': 'name',
				'Required': true
			},
			{
				'AttributeDataType': 'String',
				'DeveloperOnlyAttribute': false,
				'Mutable': false,
				'Name': 'email',
				'Required': true
			},
			{
				'AttributeDataType': 'String',
				'DeveloperOnlyAttribute': false,
				'Mutable': false,
				'Name': 'preferred_username',
				'Required': true
			}
		]
	}).promise()
	.then(result => {
		userPoolId = result.UserPool.Id;
	})
	.then(getOwnerInfo)
	.then(owner => {
		userPoolArn = `arn:${owner.partition}:cognito-idp:${awsRegion}:${owner.account}:userpool/${userPoolId}`;
	})
	.then(() => {
		const params = {
			ClientName: 'TestClient',
			UserPoolId: userPoolId,
			GenerateSecret: false,
			ExplicitAuthFlows: ['ADMIN_NO_SRP_AUTH'],
			AllowedOAuthScopes: ['email', 'openid'],
			AllowedOAuthFlows: ['code'],
			AllowedOAuthFlowsUserPoolClient: true,
			CallbackURLs: ['http://localhost:3000'],
			SupportedIdentityProviders: ['COGNITO']

		};
		return cognitoIdentityServiceProvider.createUserPoolClient(params).promise();
	});
};

module.exports.destroy = function () {
	if (userPoolId) {
		const cognitoIdentityServiceProvider = new aws.CognitoIdentityServiceProvider({ region: awsRegion });
		return cognitoIdentityServiceProvider.deleteUserPool({ UserPoolId: userPoolId }).promise();
	}
};

module.exports.getArn = function () {
	if (!userPoolArn) {
		throw 'Cognito User Pool Not Created!';
	}
	return userPoolArn;
};

module.exports.getUserToken = function () {
	if (!idToken) {
		throw 'Cognito User Pool Not Created!';
	}
	return idToken;
};
