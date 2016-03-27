/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		routes: { echo: { 'GET' : {} }}
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed(event);
};
