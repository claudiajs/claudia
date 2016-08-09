/*global require, exports */
var localDep = require('tst');
exports.handler = function (event, context) {
	'use strict';
	context.succeed(localDep());
};
