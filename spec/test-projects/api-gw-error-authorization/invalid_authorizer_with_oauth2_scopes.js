exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		authorizers: { first: { lambdaName: 'nameOnly' } },
		routes: { echo: { 'GET': {
			authorizationScopes: ['email', 'openid'] } }
		}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
