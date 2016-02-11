/*global exports, require */
var aws = require('aws-sdk');
exports.handler = function (event, context) {
	'use strict';
	var logs = new aws.CloudWatchLogs(event.region);
	logs.putLogEvents({logStreamName: event.stream, logGroupName: event.group,
		logEvents: [{ message: event.message, timestamp: Date.now()}]},
	context.done);
};
