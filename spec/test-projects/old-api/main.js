/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 3,
		routes: { echo: { 'GET': {} }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed(event);
};
