exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		authorizers: { CognitoOauth2Auth: { providerARNs: ['test name'] } },
		routes: { echo: { 'GET': {
			cognitoAuthorizer: 'CognitoOauth2Auth',
			authorizationScopes: 'email' } }
		}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
