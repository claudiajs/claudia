/*global module, require */
const retry = require('oh-no-i-insist'),
	aws = require('aws-sdk');

module.exports = function pollForLogEvents(logGroup, filterPattern, awsRegion) {
	'use strict';
	const logs = new aws.CloudWatchLogs({ region: awsRegion }),
		retryTimeout = process.env.AWS_DEPLOY_TIMEOUT || 10000,
		retries = process.env.AWS_DEPLOY_RETRIES || 5,
		checkForMatchingEvents = function (logEvents) {
			if (logEvents.events.length) {
				return logEvents.events;
			} else {
				return Promise.reject();
			}
		};

	return retry(() => {
		return logs.filterLogEvents({ logGroupName: logGroup, filterPattern: filterPattern})
		.promise()
		.then(checkForMatchingEvents);
	}, retryTimeout, retries, undefined, undefined, Promise);
};
