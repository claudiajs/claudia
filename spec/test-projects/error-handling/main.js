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
			context.succeed(request.queryString.name + ' is OK');
		}
	} catch (e) {
		context.fail(e);
	}
};
