/*global exports*/
exports.handler = function (event, context) {
	'use strict';
	context.succeed({
		statusCode: 200,
		body: JSON.stringify(event),
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
