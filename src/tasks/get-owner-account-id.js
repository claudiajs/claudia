const loggingWrap = require('../util/logging-wrap'),
	NullLogger = require('../util/null-logger'),
	aws = require('aws-sdk');
module.exports = function getOwnerAccountId(optionalLogger) {
	'use strict';
	const logger = optionalLogger || new NullLogger(),
		sts = loggingWrap(new aws.STS(), {log: logger.logApiCall, logName: 'sts'});
	return sts.getCallerIdentity().promise()
	.then(callerIdentity => callerIdentity.Account);
};
