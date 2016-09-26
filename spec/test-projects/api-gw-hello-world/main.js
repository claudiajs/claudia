/*global exports */
exports.apiConfig = function () {
	'use strict';
	return {
		version: 3,
		routes: { hello: { 'GET' : {} }}
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed({
		statusCode: 200,
		body: '"hello world"',
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
