/*global exports, global*/

if (global.MARKED) {
	throw new Error('trying to re-enter module');
}

global.MARKED = true;

exports.handler = function (event, context) {
	'use strict';

	context.succeed(event);
};
