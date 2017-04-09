/*global exports, console*/
exports.handler = function (event, context, callback) {
	'use strict';
	console.log(event);
	callback('rejected by lambda ' + context.functionName, null);
};
