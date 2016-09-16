/*global exports, require */
var ApiErrors = require('claudia-api-errors');
exports.handler = function (request, context) {
	'use strict';
	if (request.queryString.fail) {
		return context.fail(new ApiErrors.BadRequest('this call failed'));
	}
	return context.succeed(request.body.response);
};
