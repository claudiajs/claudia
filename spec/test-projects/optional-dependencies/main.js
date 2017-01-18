/*global exports, require*/
const aws = require('aws-sdk'),
	fs = require('fs');
exports.handler = function (event, context) {
	'use strict';
	const s3 = new aws.S3({region: 'us-east-1'});
	context.succeed({
		endpoint: s3.endpoint.href,
		modules: fs.readdirSync('node_modules')
	});
};
