module.exports = function loggingPolicy(awsPartition) {
	'use strict';
	if (!awsPartition) {
		throw new Error('must provide partition to loggingPolicy');
	}
	return JSON.stringify({
		'Version': '2012-10-17',
		'Statement': [
			{
				'Effect': 'Allow',
				'Action': [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents'
				],
				'Resource': `arn:${awsPartition}:logs:*:*:*`
			}
		]
	});
};
