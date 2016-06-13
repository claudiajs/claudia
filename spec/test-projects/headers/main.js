/*global exports*/
exports.handler = function (request, context) {
	'use strict';
	if (request.queryString.fail) {
		return context.fail('failing');
	}
	return context.succeed(request.body);
};
