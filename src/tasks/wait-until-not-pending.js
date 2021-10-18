const retry = require('oh-no-i-insist');
module.exports = function waitUntilNotPending(lambda, functionName, timeout, retries) {
	'use strict';
	return retry(
		() => {
			return lambda.getFunctionConfiguration({FunctionName: functionName}).promise()
				.then(result => {
					if (result.state === 'Failed') {
						throw `Lambda resource update failed`;
					}
					if (result.state === 'Pending') {
						throw 'Pending';
					}
				});
		},
		timeout,
		retries,
		failure => failure === 'Pending',
		() => console.log('Lambda function is in Pending state, waiting...'),
		Promise
	);
};


