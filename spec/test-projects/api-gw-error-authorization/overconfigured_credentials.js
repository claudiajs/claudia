/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		routes: { echo: { 'GET': { authorizationType: 'CUSTOM', invokeWithCredentials: true } }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
