/*global exports*/
exports.handler = function (request, context) {
	'use strict';
	try {
		if (!request.queryString.name) {
			throw 'name not provided';
		}
		if (!request.queryString.name.trim()) {
			throw new Error('name is blank');
		}
		if (request.queryString.name.length < 4) {
			context.fail('name too short');
		} else {
			context.succeed({response: request.queryString.name + ' is OK', headers: request.body.headers});
		}
	} catch (e) {
		context.fail(e);
	}
};
