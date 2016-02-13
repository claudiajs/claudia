/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		'echo': { methods: ['GET']}
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed(event);
};
