exports.handler = function (event, context) {
	'use strict';
	context.succeed(process.env);
};
