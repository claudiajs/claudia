/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 2,
		routes: { }
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed(event);
};
