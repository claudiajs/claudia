/*global require, module */
const ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder();

module.exports = api;

api.registerAuthorizer('testAuth', {
	lambdaName: 'TEST-AUTH-LAMBDA-NAME',
	lambdaVersion: true
});

api.get('/', () => {
	'use strict';
	return 'OK';
});

api.get('/locked', () => {
	'use strict';
	return 'NOT-OK';
}, { customAuthorizer: 'testAuth' });

api.get('/unlocked', request => {
	'use strict';
	return 'OK for ' + request.context.authorizerPrincipalId;
}, { customAuthorizer: 'testAuth' });
