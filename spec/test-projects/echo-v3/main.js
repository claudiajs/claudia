/*global exports*/
exports.handler = function (event, context) {
	'use strict';
	context.succeed({response: event, headers: {v: '3'}});
};
