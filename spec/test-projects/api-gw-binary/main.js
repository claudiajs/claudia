/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		routes: { echo: { 'POST': {} }}
	};
};
exports.handler = function (event, context) {
	'use strict';
	context.succeed({
		statusCode: 200,
		body: event.body,
		headers: {
			'Content-Type': event.headers['result-content-type']
		},
		isBase64Encoded: !!event.headers['result-encoded']
	});
};
