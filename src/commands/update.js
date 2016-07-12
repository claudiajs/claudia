/*global module, require, console*/
var Promise = require('bluebird'),
	zipdir = require('../tasks/zipdir'),
	collectFiles = require('../tasks/collect-files'),
	fs = require('fs'),
	os = require('os'),
	path = require('path'),
	readFile = Promise.promisify(fs.readFile),
	aws = require('aws-sdk'),
	shell = require('shelljs'),
	markAlias = require('../tasks/mark-alias'),
	retriableWrap = require('../util/retriable-wrap'),
	rebuildWebApi = require('../tasks/rebuild-web-api'),
	validatePackage = require('../tasks/validate-package'),
	apiGWUrl = require('../util/apigw-url'),
	promiseWrap = require('../util/promise-wrap'),
	NullLogger = require('../util/null-logger'),
	loadConfig = require('../util/loadconfig');
module.exports = function update(options, optionalLogger) {
	'use strict';
	var logger = optionalLogger || new NullLogger(),
		lambda, apiGateway, lambdaConfig, apiConfig, updateResult,
		functionConfig,
		alias = (options && options.version) || 'latest',
		packageDir,
		updateWebApi = function () {
			var apiModule, apiDef, apiModulePath;
			if (apiConfig && apiConfig.id && apiConfig.module) {
				logger.logStage('updating REST API');
				try {
					apiModulePath = path.resolve(path.join(packageDir, apiConfig.module));
					apiModule = require(apiModulePath);
					apiDef = apiModule.apiConfig();
				} catch (e) {
					console.error(e.stack || e);
					return Promise.reject('cannot load api config from ' + apiModulePath);
				}
				updateResult.url = apiGWUrl(apiConfig.id, lambdaConfig.region, alias);
				return rebuildWebApi(lambdaConfig.name, alias, apiConfig.id, apiDef, lambdaConfig.region, logger)
					.then(function () {
						if (apiModule.postDeploy) {
							return apiModule.postDeploy(
								options,
								{
									name: lambdaConfig.name,
									alias: alias,
									apiId: apiConfig.id,
									apiUrl: updateResult.url,
									region: lambdaConfig.region
								},
								{
									apiGatewayPromise: apiGateway,
									aws: aws,
									Promise: Promise
								}
							);
						}
					}).then(function (postDeployResult) {
						if (postDeployResult) {
							updateResult.deploy = postDeployResult;
						}
					});
			}
		};
	options = options || {};
	if (!options.source) {
		options.source = shell.pwd();
	}
	if (options.source === os.tmpdir()) {
		return Promise.reject('Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.');
	}

	logger.logStage('loading Lambda config');
	return loadConfig(options, {lambda: {name: true, region: true}}).then(function (config) {
		lambdaConfig = config.lambda;
		apiConfig = config.api;
		lambda = promiseWrap(new aws.Lambda({region: lambdaConfig.region}), {log: logger.logApiCall, logName: 'lambda'});
		apiGateway = retriableWrap(
				promiseWrap(
					new aws.APIGateway({region: lambdaConfig.region}),
					{log: logger.logApiCall, logName: 'apigateway'}
				),
				function () {
					logger.logStage('rate-limited by AWS, waiting before retry');
				}
		);
	}).then(function () {
		return lambda.getFunctionConfigurationPromise({FunctionName: lambdaConfig.name});
	}).then(function (result) {
		functionConfig = result;
	}).then(function () {
		if (apiConfig) {
			return apiGateway.getRestApiPromise({restApiId: apiConfig.id});
		}
	}).then(function () {
		return collectFiles(options.source, options['use-local-dependencies'], logger);
	}).then(function (dir) {
		logger.logStage('validating package');
		return validatePackage(dir, functionConfig.Handler, apiConfig && apiConfig.module);
	}).then(function (dir) {
		packageDir = dir;
		logger.logStage('zipping package');
		return zipdir(dir);
	}).then(readFile)
	.then(function (fileContents) {
		logger.logStage('updating Lambda');
		return lambda.updateFunctionCodePromise({FunctionName: lambdaConfig.name, ZipFile: fileContents, Publish: true});
	}).then(function (result) {
		updateResult = result;
		return result;
	}).then(function (result) {
		if (options.version) {
			logger.logStage('setting version alias');
			return markAlias(result.FunctionName, lambda, result.Version, options.version);
		}
	}).then(updateWebApi).then(function () {
		return updateResult;
	});
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
			argument: 'use-local-dependencies',
			optional: true,
			description: 'Do not install dependencies, use local node_modules directory instead'
		}
	]
};
