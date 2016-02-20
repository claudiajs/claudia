/*global exports, console*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 2,
		routes: { hello: { 'GET' : {} }}
	};
};
exports.router = function (event, context) {
	'use strict';
	console.log(event);
	context.succeed('hello world');
};
