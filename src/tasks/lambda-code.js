const	path = require('path'),
	fs = require('fs'),
	fsPromise = require('../util/fs-promise'),
	readFromDisk = function (packageArchive) {
		'use strict';
		return fsPromise.readFileAsync(packageArchive)
		.then(fileContents => ({ ZipFile: fileContents }));
	},
	uploadToS3 = function (s3, filePath, bucket, serverSideEncryption, s3Key) {
		'use strict';
		const fileKey = s3Key ? s3Key : path.basename(filePath),
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
module.exports = function lambdaCode(s3, zipArchive, s3Bucket, s3ServerSideEncryption, s3Key) {
	'use strict';
	if (!s3Bucket) {
		return readFromDisk(zipArchive);
	} else {
		return uploadToS3(s3, zipArchive, s3Bucket, s3ServerSideEncryption, s3Key);
	}
};
