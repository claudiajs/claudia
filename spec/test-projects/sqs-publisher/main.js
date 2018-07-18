/*global exports, console*/
const aws = require('aws-sdk'),
	sqs = new aws.SQS();
exports.handler = function (event, context) {
	'use strict';
	return sqs.sendMessage({
		QueueUrl: process.env.QUEUE_URL,
		MessageBody: JSON.stringify({ received: event, invokedFunctionArn: context.invokedFunctionArn})
	}).promise();
};
