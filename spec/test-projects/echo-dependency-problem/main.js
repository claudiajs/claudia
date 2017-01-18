/*global exports, require */
const superb = require('superb');
exports.handler = function (event, context) {
	'use strict';
	context.succeed(superb());
};
