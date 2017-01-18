/*global exports,  require */
const lib = require('lib');
exports.handler = function (event, context) {
	'use strict';
	context.succeed(lib());
};
