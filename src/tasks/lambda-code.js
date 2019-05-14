const	path = require('path'),
	fs = require('fs'),
	fsPromise = require('../util/fs-promise'),
	loggingWrap = require('../util/logging-wrap'),
	aws = require('aws-sdk'),
	readFromDisk = function (packageArchive) {
		'use strict';
		return fsPromise.readFileAsync(packageArchive)
		.then(fileContents => ({ ZipFile: fileContents }));
	},
	uploadToS3 = function (filePath, bucket, serverSideEncryption, logger) {
		'use strict';
		const fileKey = path.basename(filePath),
			params = {
				Bucket: bucket,
				Key: fileKey,
				Body: fs.createReadStream(filePath),
				ACL: 'private'
			};
		if (serverSideEncryption) {
			params.ServerSideEncryption = serverSideEncryption;
		}
		return s3.upload(params).promise()
		.then(() => ({
			S3Bucket: bucket,
			S3Key: fileKey
		}));
	};
module.exports = function lambdaCode(s3, zipArchive, s3Bucket, s3ServerSideEncryption, logger) {
	'use strict';
	if (!s3Bucket) {
		return readFromDisk(zipArchive);
	} else {
		return uploadToS3(s3, zipArchive, s3Bucket, s3ServerSideEncryption, logger);
	}
};
