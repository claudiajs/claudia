/*global exports, console*/
exports.apiConfig = function () {
	'use strict';
	return {
		'echo': { methods: ['GET'] }
	};
};
exports.router = function (event, context) {
	'use strict';
	console.log(event);
	context.succeed('hello world');
};
