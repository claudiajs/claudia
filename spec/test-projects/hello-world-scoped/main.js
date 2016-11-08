/*global exports, console*/
exports.handler = function (event, context) {
	'use strict';
	console.log(event);
	context.succeed('hello world');
};
