const loggingWrap = require('../util/logging-wrap'),
	NullLogger = require('../util/null-logger');

const {
    STS
} = require("@aws-sdk/client-sts");

module.exports = function getOwnerInfo(region, optionalLogger) {
	'use strict';
	const logger = optionalLogger || new NullLogger(),
		sts = loggingWrap(new STS({
            region: region
        }), {log: logger.logApiCall, logName: 'sts'});
	return sts.getCallerIdentity().promise()
	.then(callerIdentity => ({
		account: callerIdentity.Account,
		partition: callerIdentity.Arn.split(':')[1]
	}));
};
