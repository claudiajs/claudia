/*global exports */
if (!process.env.TEST_VAR) {
	throw 'TEST_VAR is not defined';
}
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		routes: { hello: { 'GET': {} }}
	};
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed({
		statusCode: 200,
		body: '"hello world"',
		headers: {
			'Content-Type': 'application/json'
		}
	});
};
exports.handler = exports.proxyRouter;
