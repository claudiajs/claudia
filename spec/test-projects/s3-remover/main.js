/*global exports, require, console*/
const aws = require('aws-sdk'),
	s3 = new aws.S3();
exports.handler = function (event, context) {
	'use strict';
	const eventRecord = event.Records && event.Records && event.Records[0];
	console.log('got record', eventRecord);
	if (eventRecord) {
		if (eventRecord.eventSource === 'aws:s3' && eventRecord.s3) {
			s3.deleteObject({Bucket: eventRecord.s3.bucket.name, Key: eventRecord.s3.object.key}, context.done);
		}
	}
};
