/*global exports, console, global */

if (global.MARKED) {
	throw new Error('trying to re-enter module');
}

global.MARKED = true;

exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		routes: { hello: { 'GET': {} }}
	};
};

exports.proxyRouter = function (event, context) {
	'use strict';
	console.log(event);
	context.succeed('hello world');
};
