const loadConfig = require('../util/loadconfig'),
	parseKeyValueCSV = require('../util/parse-key-value-csv'),
	aws = require('aws-sdk');

module.exports = function tag(options) {
	'use strict';
	let lambdaConfig,
		lambda;
	const initServices = function () {
			lambda = new aws.Lambda({region: lambdaConfig.region});
		},
		getLambda = () => lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name, Qualifier: options.version}).promise(),
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true}})
				.then(config => {
					lambdaConfig = config.lambda;
				})
				.then(initServices)
				.then(getLambda)
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				});
		},
		tag = function () {
			const tags = parseKeyValueCSV(options.tags);
			return lambda.tagResource({
				Resource: lambdaConfig.arn,
				Tags: tags
			}).promise();
		};
	if (!options.tags) {
		return Promise.reject('no tags specified. please provide them with --tags');
	}

	return readConfig()
		.then(tag);
};

module.exports.doc = {
	description: 'Add tags (key-value pairs) to a lambda function',
	priority: 22,
	args: [
		{
			argument: 'tags',
			example: 'Team=onboarding,Project=amarillo',
			description: 'The list of tags (key-value pairs) to assign to the lambda function.'
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
