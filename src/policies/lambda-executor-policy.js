module.exports = function lambdaExecutorPolicy() {
	'use strict';
	return JSON.stringify({
		'Version': '2012-10-17',
		'Statement': [{
			'Effect': 'Allow',
			'Principal': {'Service': 'lambda.amazonaws.com'},
			'Action': 'sts:AssumeRole'
		}]
	});
};
