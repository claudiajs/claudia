/*global module, require */
var promiseWrap = require('../util/promise-wrap'),
	NullLogger = require('../util/null-logger'),
	aws = require('aws-sdk');
module.exports = function getOwnerAccountId(optionalLogger) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		sts = promiseWrap(new aws.STS(), {log: logger.logApiCall, logName: 'sts'});
	return sts.getCallerIdentityPromise().then(function (callerIdentity) {
		return callerIdentity.Account;
	});
};
