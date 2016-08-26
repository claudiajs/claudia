/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 2,
		authorizers: { first: { lambdaArn: 'ln', lambdaVersion: 'x' } },
		routes: { echo: { 'GET' : { customAuthorizer: 'first' } }}
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed(event);
};
