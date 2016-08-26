/*global require, module */
var ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder();

module.exports = api;

api.registerAuthorizer('testAuth', {
	lambdaName: 'TEST-AUTH-LAMBDA-NAME',
	lambdaVersion: true
});

api.get('/', function () {
	'use strict';
	return 'OK';
});

api.get('/locked', function () {
	'use strict';
	return 'NOT-OK';
}, { customAuthorizer: 'testAuth' });

api.get('/unlocked', function (request) {
	'use strict';
	return 'OK for ' + request.context.authorizerPrincipalId;
}, { customAuthorizer: 'testAuth' });
