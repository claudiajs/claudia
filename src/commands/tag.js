const loadConfig = require('../util/loadconfig'),
	parseKeyValueCSV = require('../util/parse-key-value-csv'),
	getOwnerInfo = require('../tasks/get-owner-info'),
	aws = require('aws-sdk');

module.exports = function tag(options) {
	'use strict';
	let lambdaConfig,
		lambda,
		apiConfig,
		awsPartition,
		region,
		api;
	const initServices = function () {
			lambda = new aws.Lambda({region: lambdaConfig.region});
			api = new aws.APIGateway({region: lambdaConfig.region});
		},
		getLambda = () => lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name, Qualifier: options.version}).promise(),
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true}})
				.then(config => {
					lambdaConfig = config.lambda;
					apiConfig = config.api;
					region = config.region;
				})
				.then(initServices)
				.then(getLambda)
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				})
				.then(() => getOwnerInfo(region))
				.then(ownerInfo => {
					awsPartition = ownerInfo.partition;
				});
		},
		tagLambda = function (tags) {
			return lambda.tagResource({
				Resource: lambdaConfig.arn,
				Tags: tags
			}).promise();
		},
		tagApi = function (tags) {
			if (apiConfig && apiConfig.id) {
				return api.tagResource({
					resourceArn: `arn:${awsPartition}:apigateway:${lambdaConfig.region}::/restapis/${apiConfig.id}`,
					tags: tags
				}).promise();
			}
		},
		tag = function (tags) {
			return tagLambda(tags)
				.then(() => tagApi(tags));
		};
	if (!options.tags) {
		return Promise.reject('no tags specified. please provide them with --tags');
	}

	return readConfig()
		.then(() => tag(parseKeyValueCSV(options.tags)));
};

module.exports.doc = {
	description: 'Add tags (key-value pairs) to the lambda function and any associated web API',
	priority: 22,
	args: [
		{
			argument: 'tags',
			example: 'Team=onboarding,Project=amarillo',
			description: 'The list of tags (key-value pairs) to assign to the lambda function and any associated web API'
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
