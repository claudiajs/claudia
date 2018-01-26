const zipdir = require('../tasks/zipdir'),
	limits = require('../util/limits.json'),
	collectFiles = require('../tasks/collect-files'),
	os = require('os'),
	path = require('path'),
	cleanUpPackage = require('../tasks/clean-up-package'),
	aws = require('aws-sdk'),
	allowApiInvocation = require('../tasks/allow-api-invocation'),
	lambdaCode = require('../tasks/lambda-code'),
	markAlias = require('../tasks/mark-alias'),
	retriableWrap = require('../util/retriable-wrap'),
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	validatePackage = require('../tasks/validate-package'),
	apiGWUrl = require('../util/apigw-url'),
	loggingWrap = require('../util/logging-wrap'),
	initEnvVarsFromOptions = require('../util/init-env-vars-from-options'),
	NullLogger = require('../util/null-logger'),
	updateEnvVars = require('../tasks/update-env-vars'),
	getOwnerId = require('../tasks/get-owner-account-id'),
	fs = require('fs'),
	loadConfig = require('../util/loadconfig');
module.exports = function update(options, optionalLogger) {
	'use strict';
	let lambda, apiGateway, lambdaConfig, apiConfig, updateResult,
		functionConfig, packageDir, packageArchive, s3Key,
		requiresHandlerUpdate = false;
	const logger = optionalLogger || new NullLogger(),
		alias = (options && options.version) || 'latest',
		updateProxyApi = function () {
			return getOwnerId(logger)
				.then(ownerId => allowApiInvocation(lambdaConfig.name, alias, apiConfig.id, ownerId, lambdaConfig.region))
				.then(() => apiGateway.createDeploymentPromise({
					restApiId: apiConfig.id,
					stageName: alias,
					variables: {
						lambdaVersion: alias
					}
				}));
		},
		updateClaudiaApiBuilderApi = function () {
			let apiModule, apiDef, apiModulePath;
			try {
				apiModulePath = path.resolve(path.join(packageDir, apiConfig.module));
				apiModule = require(apiModulePath);
				apiDef = apiModule.apiConfig();
			} catch (e) {
				console.error(e.stack || e);
				return Promise.reject(`cannot load api config from ${apiModulePath}`);
			}

			return rebuildWebApi(lambdaConfig.name, alias, apiConfig.id, apiDef, lambdaConfig.region, logger, options['cache-api-config'])
				.then(rebuildResult => {
					if (apiModule.postDeploy) {
						return apiModule.postDeploy(
							options,
							{
								name: lambdaConfig.name,
								alias: alias,
								apiId: apiConfig.id,
								apiUrl: updateResult.url,
								region: lambdaConfig.region,
								apiCacheReused: rebuildResult.cacheReused
							},
							{
								apiGatewayPromise: apiGateway,
								aws: aws
							}
						);
					}
				})
				.then(postDeployResult => {
					if (postDeployResult) {
						updateResult.deploy = postDeployResult;
					}
				});
		},
		updateWebApi = function () {
			if (apiConfig && apiConfig.id) {
				logger.logStage('updating REST API');
				updateResult.url = apiGWUrl(apiConfig.id, lambdaConfig.region, alias);
				if (apiConfig.module) {
					return updateClaudiaApiBuilderApi();
				} else {
					return updateProxyApi();
				}
			}
		},
		updateConfiguration = function (newHandler) {
			const configurationPatch = {};
			logger.logStage('updating configuration');
			if (newHandler) {
				configurationPatch.Handler = newHandler;
			}
			if (options.timeout) {
				configurationPatch.Timeout = options.timeout;
			}
			if (options.runtime) {
				configurationPatch.Runtime = options.runtime;
			}
			if (options.memory) {
				configurationPatch.MemorySize = options.memory;
			}
			if (Object.keys(configurationPatch).length > 0) {
				configurationPatch.FunctionName = lambdaConfig.name;
				return lambda.updateFunctionConfiguration(configurationPatch).promise();
			}
		},
		cleanup = function () {
			if (!options.keep) {
				fs.unlinkSync(packageArchive);
			} else {
				updateResult.archive = packageArchive;
			}
			return updateResult;
		},
		validateOptions = function () {
			if (!options.source) {
				options.source = process.cwd();
			}
			if (options.source === os.tmpdir()) {
				return Promise.reject('Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.');
			}
			if (options['optional-dependencies'] === false && options['use-local-dependencies']) {
				return Promise.reject('incompatible arguments --use-local-dependencies and --no-optional-dependencies');
			}
			if (options.timeout || options.timeout === 0) {
				if (options.timeout < 1) {
					return Promise.reject('the timeout value provided must be greater than or equal to 1');
				}
				if (options.timeout > 300) {
					return Promise.reject('the timeout value provided must be less than or equal to 300');
				}
			}
			if (options.memory || options.memory === 0) {
				if (options.memory < limits.LAMBDA.MEMORY.MIN) {
					return Promise.reject(`the memory value provided must be greater than or equal to ${limits.LAMBDA.MEMORY.MIN}`);
				}
				if (options.memory > limits.LAMBDA.MEMORY.MAX) {
					return Promise.reject(`the memory value provided must be less than or equal to ${limits.LAMBDA.MEMORY.MAX}`);
				}
				if (options.memory % 64 !== 0) {
					return Promise.reject('the memory value provided must be a multiple of 64');
				}
			}
			return Promise.resolve();
		};
	options = options || {};

	return validateOptions()
	.then(() => {
		logger.logStage('loading Lambda config');
		return initEnvVarsFromOptions(options);
	})
	.then(() => loadConfig(options, {lambda: {name: true, region: true}}))
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
	.then(() => lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name}).promise())
	.then(result => {
		functionConfig = result;
		requiresHandlerUpdate = apiConfig && apiConfig.id && /\.router$/.test(functionConfig.Handler);
		if (requiresHandlerUpdate) {
			functionConfig.Handler = functionConfig.Handler.replace(/\.router$/, '.proxyRouter');
		} else if (options.handler) {
			functionConfig.Handler = options.handler;
			requiresHandlerUpdate = true;
		}
	})
	.then(() => {
		if (apiConfig) {
			return apiGateway.getRestApiPromise({restApiId: apiConfig.id});
		}
	})
	.then(() => collectFiles(options.source, options['use-local-dependencies'], logger))
	.then(dir => {
		logger.logStage('validating package');
		return validatePackage(dir, functionConfig.Handler, apiConfig && apiConfig.module);
	})
	.then(dir => {
		packageDir = dir;
		return cleanUpPackage(dir, options, logger);
	})
	.then(() => {
		return updateConfiguration(requiresHandlerUpdate && functionConfig.Handler);
	})
	.then(() => {
		return updateEnvVars(options, lambda, lambdaConfig.name, functionConfig.Environment && functionConfig.Environment.Variables);
	})
	.then(() => {
		logger.logStage('zipping package');
		return zipdir(packageDir);
	})
	.then(zipFile => {
		packageArchive = zipFile;
		return lambdaCode(packageArchive, options['use-s3-bucket'], options['s3-sse'], logger);
	})
	.then(functionCode => {
		logger.logStage('updating Lambda');
		s3Key = functionCode.S3Key;
		functionCode.FunctionName = lambdaConfig.name;
		functionCode.Publish = true;
		return lambda.updateFunctionCode(functionCode).promise();
	})
	.then(result => {
		updateResult = result;
		if (s3Key) {
			updateResult.s3key = s3Key;
		}
		return result;
	})
	.then(result => {
		if (options.version) {
			logger.logStage('setting version alias');
			return markAlias(result.FunctionName, lambda, result.Version, options.version);
		}
	})
	.then(updateWebApi)
	.then(cleanup);
};
module.exports.doc = {
	description: 'Deploy a new version of the Lambda function using project files, update any associated web APIs',
	priority: 2,
	args: [
		{
			argument: 'version',
			optional: true,
			description: 'A version alias to automatically assign to the new deployment',
			example: 'development'
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
			argument: 'timeout',
			optional: true,
			description: 'The function execution time, in seconds, at which AWS Lambda should terminate the function'
		},
		{
			argument: 'runtime',
			optional: true,
			description: 'Node.js runtime to use. For supported values, see\n http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html'
		},
		{
			argument: 'memory',
			optional: true,
			description: 'The amount of memory, in MB, your Lambda function is given.\nThe value must be a multiple of 64 MB.'
		},
		{
			argument: 'no-optional-dependencies',
			optional: true,
			description: 'Do not upload optional dependencies to Lambda.'
		},
		{
			argument: 'use-local-dependencies',
			optional: true,
			description: 'Do not install dependencies, use local node_modules directory instead'
		},
		{
			argument: 'cache-api-config',
			optional: true,
			example: 'claudiaConfigCache',
			description: 'Name of the stage variable for storing the current API configuration signature.\n' +
				'If set, it will also be used to check if the previously deployed configuration can be re-used and speed up deployment'
		},
		{
			argument: 'keep',
			optional: true,
			description: 'keep the produced package archive on disk for troubleshooting purposes.\n' +
				'If not set, the temporary files will be removed after the Lambda function is successfully created'
		},
		{
			argument: 'use-s3-bucket',
			optional: true,
			example: 'claudia-uploads',
			description: 'The name of a S3 bucket that Claudia will use to upload the function code before installing in Lambda.\n' +
				'You can use this to upload large functions over slower connections more reliably, and to leave a binary artifact\n' +
				'after uploads for auditing purposes. If not set, the archive will be uploaded directly to Lambda'
		},
		{
			argument: 's3-sse',
			optional: true,
			example: 'AES256',
			description: 'The type of Server Side Encryption applied to the S3 bucket referenced in `--use-s3-bucket`'
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
