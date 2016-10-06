/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 3,
		authorizers: { first: { lambdaArn: 'ln', lambdaVersion: 'x' } },
		routes: { echo: { 'GET' : { customAuthorizer: 'first' } }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
