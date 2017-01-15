/*global describe, require, it, expect, beforeEach, afterEach, console */
const underTest = require('../src/commands/set-version'),
	genericTestRole = require('./util/generic-role'),
	destroyObjects = require('./util/destroy-objects'),
	create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	retriableWrap = require('../src/util/retriable-wrap'),
	fs = require('fs'),
	path = require('path'),
	callApi = require('../src/util/call-api'),
	ArrayLogger = require('../src/util/array-logger'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region');
describe('setVersion', function () {
	'use strict';
	let workingdir, testRunName, lambda, newObjects, apiGateway;
	const invoke = function (url, options) {
		if (!options) {
			options = {};
		}
		options.retry = 403;
		return callApi(newObjects.restApi, awsRegion, url, options);
	};
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		lambda = new aws.Lambda({region: awsRegion});
		apiGateway = retriableWrap(new aws.APIGateway({region: awsRegion}));
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
	});

	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the options do not contain a version name', function (done) {
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('version misssing. please provide using --version');
			done();
		});
	});
	it('fails when the source dir does not contain the project config file', function (done) {
		underTest({source: workingdir, version: 'dev'}).then(done.fail, function (reason) {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({source: workingdir, version: 'dev'}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest({source: workingdir, version: 'dev'}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	describe('when the lambda project does not contain a web api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', role: genericTestRole.get()}).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('creates a new version alias of the lambda function', function (done) {
			underTest({source: workingdir, version: 'dev'}).then(function () {
				return lambda.getAlias({FunctionName: testRunName, Name: 'dev'}).promise();
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('1');
			}).then(done, done.fail);
		});
		it('uses the latest numeric version', function (done) {
			shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			update({source: workingdir}).then(function () {
				return underTest({source: workingdir, version: 'dev'});
			}).then(function () {
				return lambda.getAlias({FunctionName: testRunName, Name: 'dev'}).promise();
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('2');
			}).then(done, done.fail);
		});
		it('migrates an alias if it already exists', function (done) {
			shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			lambda.createAlias({
				FunctionName: testRunName,
				FunctionVersion: '1',
				Name: 'dev'
			}).promise().then(function () {
				return update({source: workingdir});
			}).then(function () {
				return underTest({source: workingdir, version: 'dev'});
			}).then(function () {
				return lambda.getAlias({FunctionName: testRunName, Name: 'dev'}).promise();
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('2');
			}).then(done, done.fail);
		});
	});
	describe('when the lambda project contains a web api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/api-gw-echo/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, 'api-module': 'main', role: genericTestRole.get()}).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
			}).then(done, done.fail);
		});
		it('creates a new api deployment', function (done) {
			underTest({source: workingdir, version: 'dev'})
			.then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/dev');
			}).then(function () {
				return invoke('dev/echo');
			}).then(function (contents) {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'dev'
				});
			}).then(done, done.fail);
		});
		it('keeps the old stage variables if they exist', function (done) {
			apiGateway.createDeploymentPromise({
				restApiId: newObjects.restApi,
				stageName: 'fromtest',
				variables: {
					authKey: 'abs123',
					authBucket: 'bucket123',
					lambdaVersion: 'fromtest'
				}
			}).then(function () {
				return underTest({source: workingdir, version: 'fromtest'});
			}).then(function () {
				return invoke('fromtest/echo');
			}).then(function (contents) {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'fromtest',
					authKey: 'abs123',
					authBucket: 'bucket123'
				});
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
	});
	describe('when the lambda project contains a proxy api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', 'deploy-proxy-api': true, role: genericTestRole.get()}).then(function (result) {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
			}).then(done, done.fail);
		});
		it('creates a new api deployment', function (done) {
			underTest({source: workingdir, version: 'dev'})
			.then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/dev');
			}).then(function () {
				return invoke('dev/echo');
			}).then(function (contents) {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/{proxy+}');
				expect(params.path).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'dev'
				});
			}).then(done, done.fail);
		});
		it('keeps the old stage variables if they exist', function (done) {
			apiGateway.createDeploymentPromise({
				restApiId: newObjects.restApi,
				stageName: 'fromtest',
				variables: {
					authKey: 'abs123',
					authBucket: 'bucket123',
					lambdaVersion: 'fromtest'
				}
			}).then(function () {
				return underTest({source: workingdir, version: 'fromtest'});
			}).then(function () {
				return invoke('fromtest/echo');
			}).then(function (contents) {
				const params = JSON.parse(contents.body);
				expect(params.requestContext.resourcePath).toEqual('/{proxy+}');
				expect(params.path).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'fromtest',
					authKey: 'abs123',
					authBucket: 'bucket123'
				});
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail(e);
			});
		});
	});

	it('logs progress', function (done) {
		const logger = new ArrayLogger();
		shell.cp('-r', 'spec/test-projects/api-gw-echo/*', workingdir);
		create({name: testRunName, region: awsRegion, source: workingdir, 'api-module': 'main', role: genericTestRole.get()}).then(function (result) {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
			newObjects.restApi = result.api && result.api.id;
		}).then(function () {
			return underTest({source: workingdir, version: 'dev'}, logger);
		}).then(function () {
			expect(logger.getStageLog(true).filter(function (entry) {
				return entry !== 'rate-limited by AWS, waiting before retry';
			})).toEqual([
				'loading config', 'updating configuration', 'updating versions'
			]);
			expect(logger.getApiCallLogForService('lambda', true)).toEqual(['lambda.publishVersion', 'lambda.updateAlias', 'lambda.createAlias']);
			expect(logger.getApiCallLogForService('sts', true)).toEqual(['sts.getCallerIdentity']);
			expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
				'apigateway.createDeployment',
				'apigateway.setupRequestListeners',
				'apigateway.setAcceptHeader']);
		}).then(done, done.fail);
	});

	describe('environment variables', function () {
		let standardEnvKeys, logger;
		const nonStandard = function (key) {
			return standardEnvKeys.indexOf(key) < 0;
		};
		beforeEach(function (done) {
			logger = new ArrayLogger();
			standardEnvKeys = [
				'PATH', 'LANG', 'LD_LIBRARY_PATH', 'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', 'AWS_REGION',
				'AWS_DEFAULT_REGION', 'AWS_LAMBDA_LOG_GROUP_NAME', 'AWS_LAMBDA_LOG_STREAM_NAME',
				'AWS_LAMBDA_FUNCTION_NAME', 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 'AWS_LAMBDA_FUNCTION_VERSION',
				'NODE_PATH', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'
			].sort();
			shell.cp('-r', 'spec/test-projects/env-vars/*', workingdir);
			create({
				name: testRunName,
				version: 'original',
				region: awsRegion,
				source: workingdir,
				'handler': 'main.handler',
				'set-env': 'XPATH=/var/www,YPATH=/var/lib'
			}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('does not change environment variables if set-env not provided', function (done) {
			return underTest({source: workingdir, version: 'new'}, logger).then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'new'
				}).promise();
			}).then(function (configuration) {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/var/www',
						'YPATH': '/var/lib'
					}
				});
			}).then(function () {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(function (result) {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'YPATH']);
				expect(env.XPATH).toEqual('/var/www');
				expect(env.YPATH).toEqual('/var/lib');
			}).then(done, done.fail);
		});
		it('changes environment variables if set-env is provided', function (done) {
			return underTest({source: workingdir, version: 'new', 'set-env': 'XPATH=/opt,ZPATH=/usr'}, logger).then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'new'
				}).promise();
			}).then(function (configuration) {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/opt',
						'ZPATH': '/usr'
					}
				});
			}).then(function () {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(function (result) {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'ZPATH']);
				expect(env.XPATH).toEqual('/opt');
				expect(env.YPATH).toBeFalsy();
				expect(env.ZPATH).toEqual('/usr');
			}).then(done, done.fail);
		});
		it('changes env variables specified in a JSON file', function (done) {
			const envpath = path.join(workingdir, 'env.json');
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/opt', 'ZPATH': '/usr'}), 'utf8');
			return underTest({source: workingdir, version: 'new', 'set-env-from-json': envpath}, logger).then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'new'
				}).promise();
			}).then(function (configuration) {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/opt',
						'ZPATH': '/usr'
					}
				});
			}).then(function () {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(function (result) {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'ZPATH']);
				expect(env.XPATH).toEqual('/opt');
				expect(env.YPATH).toBeFalsy();
				expect(env.ZPATH).toEqual('/usr');
			}).then(done, done.fail);
		});
		it('refuses to work if reading the variables fails', function (done) {
			return underTest({source: workingdir, version: 'new', 'set-env': 'XPATH,ZPATH=/usr'}, logger).then(done.fail, function (message) {
				expect(message).toEqual('Cannot read variables from set-env, Invalid CSV element XPATH');
				expect(logger.getApiCallLogForService('lambda', true)).toEqual([]);
				expect(logger.getApiCallLogForService('iam', true)).toEqual([]);
				done();
			});
		});
	});
});
