module.exports = function vpcPolicy() {
	'use strict';
	return JSON.stringify({
		'Version': '2012-10-17',
		'Statement': [{
			'Sid': 'VPCAccessExecutionPermission',
			'Effect': 'Allow',
			'Action': [
				'logs:CreateLogGroup',
				'logs:CreateLogStream',
				'logs:PutLogEvents',
				'ec2:CreateNetworkInterface',
				'ec2:DeleteNetworkInterface',
				'ec2:DescribeNetworkInterfaces'
			],
			'Resource': '*'
		}]
	});
};
