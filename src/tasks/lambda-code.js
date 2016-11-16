/*global require, module */
var	path = require('path'),
	fs = require('../util/fs-promise'),
	loggingWrap = require('../util/logging-wrap'),
	aws = require('aws-sdk'),
	readFromDisk = function (packageArchive) {
		'use strict';
		return fs.readFileAsync(packageArchive).then(function (fileContents) {
			return { ZipFile: fileContents };
		});
	},
	uploadToS3 = function (filePath, bucket, logger) {
		'use strict';
		var fileKey = path.basename(filePath),
			s3 = loggingWrap(new aws.S3({signatureVersion: 'v4'}), {log: logger.logApiCall, logName: 's3'});
		return s3.upload({
				Bucket: bucket,
				Key: fileKey,
				Body: fs.createReadStream(filePath),
				ACL: 'private'
			}).promise().then(function () {
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

