/*global require */

let queueUrl;
const aws = require('aws-sdk'),
	awsRegion = require('./test-aws-region'),
	sqs = new aws.SQS({region: awsRegion}),
	retry = require('oh-no-i-insist'),
	genericQueueName = 'test-queue-' + Date.now(),
	getQueueUrl = function () {
		'use strict';
		if (queueUrl) {
			return Promise.resolve(queueUrl);
		} else {
			return sqs.createQueue({
				QueueName: genericQueueName
			}).promise()
			.then(result => {
				queueUrl = result.QueueUrl;
				return queueUrl;
			});
		}
	};


module.exports.getQueueUrl = getQueueUrl;
module.exports.waitForMessage = function (contents) {
	'use strict';
	return getQueueUrl()
		.then(queueUrl => {
			return retry(() => {
				return sqs.receiveMessage({
					QueueUrl: queueUrl,
					MaxNumberOfMessages: 1,
					WaitTimeSeconds: 5
				}).promise().then(response => {
					const match = response && response.Messages &&
						response.Messages.find(message => message.Body.indexOf(contents) > -1);
					if (match) {
						return sqs.deleteMessage({
							QueueUrl: queueUrl,
							ReceiptHandle: match.ReceiptHandle
						}).promise()
						.then(() => Promise.resolve(match));
					}
					return Promise.reject('message not received');
				});
			}, 500, 10, undefined, undefined, Promise);
		});

};
module.exports.destroy = function () {
	'use strict';
	if (!queueUrl) {
		return Promise.resolve();
	} else {
		return sqs.deleteQueue({QueueUrl: queueUrl}).promise();
	}
};
