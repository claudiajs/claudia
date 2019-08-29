module.exports = function snsPublishPolicy(arn) {
	'use strict';
	return JSON.stringify({
		'Version': '2012-10-17',
		'Statement': [
			{
				'Effect': 'Allow',
				'Action': [
					'sns:Publish'
				],
				'Resource': [
					arn
				]
			}
		]
	});
};
