/*global require, module */
const ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder();

module.exports = api;

api.registerAuthorizer('CognitoOauth2Auth', {
	providerARNs: ['TEST-USER-POOL-ARN']
});

api.get('/', () => {
	'use strict';
	return 'setup ok';
});

api.get('/locked', () => {
	'use strict';
	return 'testing scopes';
}, { cognitoAuthorizer: 'CognitoOauth2Auth',
	authorizationScopes: ['email', 'openid']
});
