const loadConfig = require('../util/loadconfig'),
	fsPromise = require('../util/fs-promise');

const {
    Lambda
} = require("@aws-sdk/client-lambda");

module.exports = function testLambda(options) {
	'use strict';
	let lambdaConfig;
	const getPayload = function () {
		if (!options.event) {
			return Promise.resolve('');
		} else {
			return fsPromise.readFileAsync(options.event, 'utf-8');
		}
	};

	return loadConfig(options, {lambda: {name: true, region: true}})
	.then(config => {
		lambdaConfig = config.lambda;
	})
	.then(getPayload)
	.then(payload => {
		const lambda = new Lambda({region: lambdaConfig.region});
		return lambda.invoke(
            {FunctionName: lambdaConfig.name, Payload: payload, Qualifier: options.version}
        );
	});
};
module.exports.doc = {
	description: 'Execute the lambda function and print out the response',
	priority: 8,
	args: [
		{
			argument: 'event',
			optional: true,
			description: 'Path to a file containing the JSON test event'
		},
		{
			argument: 'version',
			optional: true,
			description: 'A version alias to test',
			default: 'latest version'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			default: 'current directory'
		},
		{
			argument: 'config',
			optional: true,
			description: 'Config file containing the resource names',
			default: 'claudia.json'
		}
	]
};
