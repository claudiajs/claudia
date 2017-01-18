/*global exports */
const generatePolicy = function (authToken, methodArn) {
	'use strict';
	const tmp = methodArn.split(':'),
		apiGatewayArnTmp = tmp[5].split('/'),
		awsAccountId = tmp[4],
		region = tmp[3],
		restApiId = apiGatewayArnTmp[0],
		stage = apiGatewayArnTmp[1];

	return {
		'principalId': authToken.split('-')[0],
		'policyDocument': {
			'Version': '2012-10-17',
			'Statement': [{
				'Effect': 'Allow',
				'Action': [
					'execute-api:Invoke'
				],
				'Resource': [
					'arn:aws:execute-api:' + region + ':'  + awsAccountId + ':' + restApiId + '/' + stage + '/GET/unlocked'
				]
			}]
		}
	};
};
exports.auth = function testAuth(event, context, callback) {
	'use strict';
	if (event && event.authorizationToken && event.methodArn) {
		callback(null, generatePolicy(event.authorizationToken, event.methodArn));
	} else {
		callback('Unauthorized');
	}
};
