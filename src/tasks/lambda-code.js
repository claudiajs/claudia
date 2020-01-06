const	path = require('path'),
	fs = require('fs'),
	fsPromise = require('../util/fs-promise'),
	readFromDisk = function (packageArchive) {
		'use strict';
		return fsPromise.readFileAsync(packageArchive)
		.then(fileContents => ({ ZipFile: fileContents }));
	},
	uploadToS3 = function (s3, filePath, bucket, serverSideEncryption) {
		'use strict';
		const s3Options = bucket.match(/([^\/]+)\/(.+$)/),
			params = {
				Body: fs.createReadStream(filePath),
				ACL: 'private'
			};
		let s3Bucket, s3FileKey;
		if (s3Options) {
			s3Bucket = s3Options[1];
			s3FileKey = /.+\.zip$/g.test(s3Options[2]) ? `${s3Options[2]}` : `${s3Options[2]}.zip`;
		} else {
			s3Bucket = bucket;
			s3FileKey = path.basename(filePath);
		}
		params.Bucket = s3Bucket;
		params.Key = s3FileKey;
		if (serverSideEncryption) {
			params.ServerSideEncryption = serverSideEncryption;
		}
		return s3.upload(params).promise()
		.then(() => ({
			S3Bucket: s3Bucket,
			S3Key: s3FileKey
		}));
	};
module.exports = function lambdaCode(s3, zipArchive, s3Bucket, s3ServerSideEncryption) {
	'use strict';
	if (!s3Bucket) {
		return readFromDisk(zipArchive);
	} else {
		return uploadToS3(s3, zipArchive, s3Bucket, s3ServerSideEncryption);
	}
};
