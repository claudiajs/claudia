/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 3,
		routes: { echo: { 'GET' : { error: { headers: {}}} }}
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed(event);
};
