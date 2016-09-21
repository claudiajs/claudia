/*global require, module */
var	Promise = require('bluebird'),
	path = require('path'),
	fs = Promise.promisifyAll(require('fs')),
	aws = require('aws-sdk'),
	promiseWrap = require('../util/promise-wrap'),
	readFromDisk = function (packageArchive) {
		'use strict';
		return fs.readFileAsync(packageArchive).then(function (fileContents) {
			return { ZipFile: fileContents };
		});
	},
	uploadToS3 = function (filePath, bucket, logger) {
		'use strict';
		var fileKey = path.basename(filePath),
			s3 = promiseWrap(new aws.S3(), {log: logger.logApiCall, logName: 's3'});
		return s3.uploadPromise({
				Bucket: bucket,
				Key: fileKey,
				Body: fs.createReadStream(filePath),
				ACL: 'private'
			}).then(function () {
				return {
					S3Bucket: bucket,
					S3Key: fileKey
				};
			});
	};
module.exports = function lambdaCode(zipArchive, s3Bucket, logger) {
	'use strict';
	if (!s3Bucket) {
		return readFromDisk(zipArchive);
	} else {
		return uploadToS3(zipArchive, s3Bucket, logger);
	}
};

