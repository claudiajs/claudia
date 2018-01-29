/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		authorizers: { first: { lambda: 'ln' } },
		routes: { echo: { 'GET': { customAuthorizer: 'first' } }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
