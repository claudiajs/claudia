/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 3,
		authorizers: { first: { lambdaName: 'ln' } },
		routes: { echo: { 'GET' : { customAuthorizer: 'customA' } }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
