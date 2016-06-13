/*global exports, require */
var superb = require('superb');
exports.handler = function (event, context) {
	'use strict';
	context.succeed(superb());
};
