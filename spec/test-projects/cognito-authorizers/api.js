/*global require, module */
const ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder();

module.exports = api;

api.registerAuthorizer('CognitoAuth', {
	providerARNs: ['TEST-USER-POOL-ARN']
});

api.get('/', () => {
	'use strict';
	return 'OK';
});

api.get('/locked', () => {
	'use strict';
	return 'NOT-OK';
}, { cognitoAuthorizer: 'CognitoAuth' });

api.get('/unlocked', request => {
	'use strict';
	console.log(request);
	if (request.proxyRequest && request.proxyRequest.requestContext && request.proxyRequest.requestContext.authorizer && request.proxyRequest.requestContext.authorizer.claims) {
		return 'OK for ' + request.proxyRequest.requestContext.authorizer.claims['cognito:username'];
	} else {
		return 'NOT-OK';
	}
}, { cognitoAuthorizer: 'CognitoAuth' });
