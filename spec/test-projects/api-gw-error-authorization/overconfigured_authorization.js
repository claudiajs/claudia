/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		authorizers: { customA: { lambdaName: 'nnn' } },
		routes: { echo: { 'GET': { authorizationType: 'AWS_IAM', customAuthorizer: 'customA' } }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
