/*global exports,  require */
var lib = require('lib');
exports.handler = function (event, context) {
	'use strict';
	context.succeed(lib());
};
