/*global exports*/
exports.handler = function (request, context) {
	'use strict';
	return context.succeed({
		headers: JSON.parse(request.body),
		statusCode: 200,
		body: ''
	});
};
