/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 2,
		routes: { echo: { 'GET' : { authorizationType: 'CUSTOM', invokeWithCredentials: true } }}
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed(event);
};
