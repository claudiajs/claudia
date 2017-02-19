/*global require */
/*eslint "strict": ["error", "global"] */
'use strict';
const aws = require('aws-sdk'),
	awsRegion = require('./test-aws-region'),
	getOwnerId = require('../../src/tasks/get-owner-account-id'),
	userPoolName = 'test-user-pool-' + Date.now();

let userPoolId, clientId, userPoolArn, idToken;

module.exports.create = function create() {
	const cognitoIdentityServiceProvider = new aws.CognitoIdentityServiceProvider({ region: awsRegion });
	return cognitoIdentityServiceProvider.createUserPool({ PoolName: userPoolName }).promise()
	.then(result => {
		userPoolId = result.UserPool.Id;
	})
	.then(getOwnerId)
	.then(accountId => {
		userPoolArn = `arn:aws:cognito-idp:${awsRegion}:${accountId}:userpool/${userPoolId}`;
	})
	.then(() => {
		const params = {
			ClientName: 'TestClient',
			UserPoolId: userPoolId,
			GenerateSecret: false,
			ExplicitAuthFlows: ['ADMIN_NO_SRP_AUTH']
		};
		return cognitoIdentityServiceProvider.createUserPoolClient(params).promise();
	})
	.then(result => {
		clientId = result.UserPoolClient.ClientId;
	})
	.then(() => {
		const params = {
			ClientId: clientId,
			Username: 'Bob-123',
			Password: 'Password1!'
		};
		return cognitoIdentityServiceProvider.signUp(params).promise();
	})
	.then(() => {
		const params = {
			UserPoolId: userPoolId,
			Username: 'Bob-123'
		};
		return cognitoIdentityServiceProvider.adminConfirmSignUp(params).promise();
	})
	.then(() => {
		const params = {
			ClientId: clientId,
			UserPoolId: userPoolId,
			AuthFlow: 'ADMIN_NO_SRP_AUTH',
			AuthParameters: {
				USERNAME: 'Bob-123',
				PASSWORD: 'Password1!'
			}
		};
		return cognitoIdentityServiceProvider.adminInitiateAuth(params).promise();
	})
	.then(result => {
		idToken = result.AuthenticationResult.IdToken;
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
