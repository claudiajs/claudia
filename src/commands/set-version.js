const aws = require('aws-sdk'),
	loadConfig = require('../util/loadconfig'),
	allowApiInvocation = require('../tasks/allow-api-invocation'),
	retriableWrap = require('../util/retriable-wrap'),
	loggingWrap = require('../util/logging-wrap'),
	readEnvVarsFromOptions = require('../util/read-env-vars-from-options'),
	updateEnvVars = require('../tasks/update-env-vars'),
	apiGWUrl = require('../util/apigw-url'),
	NullLogger = require('../util/null-logger'),
	markAlias = require('../tasks/mark-alias'),
	getOwnerInfo = require('../tasks/get-owner-info');
module.exports = function setVersion(options, optionalLogger) {
	'use strict';
	let lambdaConfig, lambda, apiGateway, apiConfig;
	const logger = optionalLogger || new NullLogger(),
		updateApi = function () {
			return getOwnerInfo(options.region, logger)
			.then(ownerInfo => allowApiInvocation(lambdaConfig.name, options.version, apiConfig.id, ownerInfo.account, ownerInfo.partition, lambdaConfig.region))
			.then(() => apiGateway.createDeploymentPromise({
				restApiId: apiConfig.id,
				stageName: options.version,
				variables: {
					lambdaVersion: options.version
				}
			}))
			.then(() => ({ url: apiGWUrl(apiConfig.id, lambdaConfig.region, options.version) }));
		},
		updateConfiguration = function () {
			logger.logStage('updating configuration');
			return Promise.resolve()
				.then(() => lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name}).promise())
				.then(functionConfiguration => updateEnvVars(options, lambda, lambdaConfig.name, functionConfiguration.Environment && functionConfiguration.Environment.Variables));
		};

	if (!options.version) {
		return Promise.reject('version misssing. please provide using --version');
	}
	try {
		readEnvVarsFromOptions(options);
	} catch (e) {
		return Promise.reject(e);
	}
	logger.logStage('loading config');
	return loadConfig(options, {lambda: {name: true, region: true}})
	.then(config => {
		lambdaConfig = config.lambda;
		apiConfig = config.api;
		lambda = loggingWrap(new aws.Lambda({region: lambdaConfig.region}), {log: logger.logApiCall, logName: 'lambda'});
		apiGateway = retriableWrap(
			loggingWrap(
				new aws.APIGateway({region: lambdaConfig.region}),
				{log: logger.logApiCall, logName: 'apigateway'}
			),
			() => logger.logStage('rate-limited by AWS, waiting before retry')
		);
	})
	.then(updateConfiguration)
	.then(() => {
		logger.logStage('updating versions');
		return lambda.publishVersion({FunctionName: lambdaConfig.name}).promise();
	})
	.then(versionResult => markAlias(lambdaConfig.name, lambda, versionResult.Version, options.version))
	.then(() => {
		if (apiConfig && apiConfig.id) {
			return updateApi();
		}
	});
};
module.exports.doc = {
	description: 'Create or update a lambda alias/api stage to point to the latest deployed version',
	priority: 3,
	args: [
		{
			argument: 'version',
			description: 'the alias to update or create',
			example: 'production'
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
		},
		{
			argument: 'update-env',
			optional: true,
			example: 'S3BUCKET=testbucket,SNSQUEUE=testqueue',
			description: 'comma-separated list of VAR=VALUE environment variables to set, merging with old variables'
		},
		{
			argument: 'set-env',
			optional: true,
			example: 'S3BUCKET=testbucket,SNSQUEUE=testqueue',
			description: 'comma-separated list of VAR=VALUE environment variables to set. replaces the whole set, removing old variables.'
		},
		{
			argument: 'update-env-from-json',
			optional: true,
			example: 'production-env.json',
			description: 'file path to a JSON file containing environment variables to set, merging with old variables'
		},

		{
			argument: 'set-env-from-json',
			optional: true,
			example: 'production-env.json',
			description: 'file path to a JSON file containing environment variables to set. replaces the whole set, removing old variables.'
		},
		{
			argument: 'env-kms-key-arn',
			optional: true,
			description: 'KMS Key ARN to encrypt/decrypt environment variables'
		}
	]
};
