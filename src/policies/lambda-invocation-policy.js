module.exports = function lambdaInvocationPolicy(functionName, awsPartition, awsRegion) {
	'use strict';
	return JSON.stringify({
		'Version': '2012-10-17',
		'Statement': [{
			'Sid': 'InvokePermission',
			'Effect': 'Allow',
			'Action': [
				'lambda:InvokeFunction'
			],
			'Resource': 'arn:' + awsPartition + ':lambda:' + awsRegion + ':*:function:' + functionName
		}]
	});
};

