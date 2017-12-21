/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		routes: { echo: { 'GET': {} }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed({
		body: JSON.stringify(event),
		statusCode: 200
	});
};
