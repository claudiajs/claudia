/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine, global, __dirname */
var underTest = require('../src/commands/update'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	ArrayLogger = require('../src/util/array-logger'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs')),
	path = require('path'),
	aws = require('aws-sdk'),
	os = require('os'),
	awsRegion = 'us-east-1';
describe('update', function () {
	'use strict';
	var workingdir, testRunName,  lambda, newObjects,
		invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(newObjects.restApi, awsRegion, url, options);
		};
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'});
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
		newObjects = {workingdir: workingdir};
		shell.mkdir(workingdir);
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	it('fails when the source dir does not contain the project config file', function (done) {
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails if the source folder is same as os tmp folder', function (done) {
		shell.cp('-rf', 'spec/test-projects/hello-world/*', os.tmpdir());
		fs.writeFileSync(path.join(os.tmpdir(), 'claudia.json'), JSON.stringify({lambda: {name: 'xxx', region: 'us-east-1'}}), 'utf8');
		underTest({source: os.tmpdir()}).then(done.fail, function (message) {
			expect(message).toEqual('Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest({source: workingdir}).then(done.fail, function (reason) {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	it('fails if local dependencies and optional dependencies are mixed', function (done) {
		shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
		underTest({source: workingdir, 'use-local-dependencies': true, 'no-optional-dependencies': true}).then(done.fail, function (message) {
			expect(message).toEqual('incompatible arguments --use-local-dependencies and --no-optional-dependencies');
			done();
		});
	});

	describe('when the config exists', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				shell.cp('-rf', 'spec/test-projects/echo/*', workingdir);
			}).then(done, done.fail);
		});
		it('fails if the lambda no longer exists', function (done) {
			fs.readFileAsync(path.join(workingdir, 'claudia.json'), 'utf8')
			.then(JSON.parse)
			.then(function (contents) {
				contents.lambda.name = contents.lambda.name + '-xxx';
				return contents;
			}).then(JSON.stringify)
			.then(function (contents) {
				return fs.writeFileAsync(path.join(workingdir, 'claudia.json'), contents, 'utf8');
			}).then(function () {
				return underTest({source: workingdir});
			}).then(done.fail, function (reason) {
				expect(reason.code).toEqual('ResourceNotFoundException');
			}).then(done);
		});
		it('validates the package before updating the lambda', function (done) {
			shell.cp('-rf', 'spec/test-projects/echo-dependency-problem/*', workingdir);
			underTest({source: workingdir})
			.then(done.fail, function (reason) {
				expect(reason).toEqual('cannot require ./main after npm install --production. Check your dependencies.');
			}).then(function () {
				return lambda.listVersionsByFunctionPromise({FunctionName: testRunName});
			}).then(function (result) {
				expect(result.Versions.length).toEqual(2);
			}).then(done, done.fail);
		});
		it('creates a new version of the lambda function', function (done) {
			underTest({source: workingdir}).then(function (lambdaFunc) {
				expect(new RegExp('^arn:aws:lambda:us-east-1:[0-9]+:function:' + testRunName + ':2$').test(lambdaFunc.FunctionArn)).toBeTruthy();
			}).then(function () {
				return lambda.listVersionsByFunctionPromise({FunctionName: testRunName});
			}).then(function (result) {
				expect(result.Versions.length).toEqual(3);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
				expect(result.Versions[2].Version).toEqual('2');
			}).then(done, done.fail);
		});
		it('updates the lambda with a new version', function (done) {
			underTest({source: workingdir}).then(function () {
				return lambda.invokePromise({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"message":"aloha"}');
			}).then(done, done.fail);
		});

		it('keeps the archive on the disk if --keep is specified', function (done) {
			underTest({source: workingdir, keep: true}).then(function (result) {
				expect(result.archive).toBeTruthy();
				expect(shell.test('-e', result.archive));
			}).then(done, done.fail);
		});

		it('uses local dependencies if requested', function (done) {
			shell.cp('-rf', path.join(__dirname, 'test-projects', 'local-dependencies', '*'), workingdir);

			shell.rm('-rf', path.join(workingdir, 'node_modules'));
			shell.mkdir(path.join(workingdir, 'node_modules'));
			shell.cp('-r', path.join(workingdir, 'local_modules', '*'),  path.join(workingdir, 'node_modules'));

			underTest({source: workingdir, 'use-local-dependencies': true}).then(function () {
				return lambda.invokePromise({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello local"');
			}).then(done, done.fail);
		});
		it('removes optional dependencies after validation if requested', function (done) {
			shell.cp('-rf', path.join(__dirname, '/test-projects/optional-dependencies/*'), workingdir);
			underTest({source: workingdir, 'no-optional-dependencies': true}).then(function () {
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"endpoint":"https://s3.amazonaws.com/","modules":[".bin","huh"]}');
			}).then(done, done.fail);
		});
		it('rewires relative dependencies to reference original location after copy', function (done) {
			shell.cp('-r', path.join(__dirname, 'test-projects/relative-dependencies/*'), workingdir);
			shell.cp('-r', path.join(workingdir, 'claudia.json'), path.join(workingdir, 'lambda'));
			underTest({source: path.join(workingdir, 'lambda')}).then(function () {
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello relative"');
			}).then(done, done.fail);
		});

		it('uses a s3 bucket if provided', function (done) {
			var s3 = Promise.promisifyAll(new aws.S3()),
				logger = new ArrayLogger(),
				bucketName = testRunName + '-bucket',
				archivePath;
			s3.createBucketAsync({
				Bucket: bucketName
			}).then(function () {
				newObjects.s3bucket = bucketName;
			}).then(function () {
				return underTest({keep: true, 'use-s3-bucket': bucketName, source: workingdir}, logger);
			}).then(function (result) {
				var expectedKey = path.basename(result.archive);
				archivePath = result.archive;
				expect(result.s3key).toEqual(expectedKey);
				return s3.headObjectAsync({
					Bucket: bucketName,
					Key: expectedKey
				});
			}).then(function (fileResult) {
				expect(parseInt(fileResult.ContentLength)).toEqual(fs.statSync(archivePath).size);
			}).then(function () {
				expect(logger.getApiCallLogForService('s3', true)).toEqual(['s3.upload']);
			}).then(function () {
				return lambda.invokePromise({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"message":"aloha"}');
			}).then(done, done.fail);
		});

		it('adds the version alias if supplied', function (done) {
			underTest({source: workingdir, version: 'great'}).then(function () {
				return lambda.getAliasPromise({FunctionName: testRunName, Name: 'great'});
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('2');
			}).then(done, done.fail);
		});

		it('checks the current dir if the source is not provided', function (done) {
			shell.cd(workingdir);
			underTest().then(function (lambdaFunc) {
				expect(new RegExp('^arn:aws:lambda:us-east-1:[0-9]+:function:' + testRunName + ':2$').test(lambdaFunc.FunctionArn)).toBeTruthy();
				expect(lambdaFunc.FunctionName).toEqual(testRunName);
				return lambda.invokePromise({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})});
			}).then(done, done.fail);
		});
	});
	describe('when the lambda project contains a proxy api', function () {
		beforeEach(function (done) {
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			create({name: testRunName, version: 'original', region: awsRegion, source: workingdir, handler: 'main.handler', 'deploy-proxy-api': true}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
			}).then(done, done.fail);
		});
		it('if using a different version, deploys a new stage', function (done) {
			underTest({source: workingdir, version: 'development'}).then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/development');
			}).then(function () {
				return invoke('development/hello?abc=def');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({abc: 'def'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.path).toEqual('/hello');
				expect(params.requestContext.stage).toEqual('development');
			}).then(done, function (e) {
				console.log(e);
				done.fail();
			});
		});
	});
	describe('when the lambda project contains a web api', function () {
		var originaldir, updateddir;
		beforeEach(function (done) {
			originaldir =  path.join(workingdir, 'original');
			updateddir = path.join(workingdir, 'updated');
			shell.mkdir(originaldir);
			shell.mkdir(updateddir);
			shell.cp('-r', 'spec/test-projects/api-gw-hello-world/*', originaldir);
			shell.cp('-r', 'spec/test-projects/api-gw-echo/*', updateddir);
			create({name: testRunName, version: 'original', region: awsRegion, source: originaldir, 'api-module': 'main'}).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
				shell.cp(path.join(originaldir, 'claudia.json'), updateddir);
			}).then(done, done.fail);
		});
		it('fails if the api no longer exists', function (done) {
			fs.readFileAsync(path.join(updateddir, 'claudia.json'), 'utf8')
			.then(JSON.parse)
			.then(function (contents) {
				contents.api.id = contents.api.id + '-xxx';
				return contents;
			}).then(JSON.stringify)
			.then(function (contents) {
				return fs.writeFileAsync(path.join(updateddir, 'claudia.json'), contents, 'utf8');
			}).then(function () {
				return underTest({source: updateddir});
			}).then(done.fail, function (reason) {
				expect(reason.code).toEqual('NotFoundException');
			}).then(function () {
				return lambda.listVersionsByFunctionPromise({FunctionName: testRunName});
			}).then(function (result) {
				expect(result.Versions.length).toEqual(2);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
			}).then(done, done.fail);
		});
		it('validates the package before creating a new lambda version', function (done) {
			shell.cp('-rf', 'spec/test-projects/echo-dependency-problem/*', updateddir);
			underTest({source: updateddir}).then(done.fail, function (reason) {
				expect(reason).toEqual('cannot require ./main after npm install --production. Check your dependencies.');
			}).then(function () {
				return lambda.listVersionsByFunctionPromise({FunctionName: testRunName});
			}).then(function (result) {
				expect(result.Versions.length).toEqual(2);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
			}).then(done, done.fail);
		});


		it('updates the api using the configuration from the api module', function (done) {
			return underTest({source: updateddir}).then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
			}).then(function () {
				return invoke('latest/echo?name=mike');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'latest'
				});
			}).then(done, done.fail);
		});
		it('upgrades the function handler from 1.x', function (done) {
			lambda.updateFunctionConfigurationPromise({
				FunctionName: testRunName,
				Handler: 'main.router'
			}).then(function () {
				return underTest({source: updateddir});
			}).then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
			}).then(function () {
				return invoke('latest/echo?name=mike');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'latest'
				});
			}).then(done, done.fail);
		});

		it('works when the source is a relative path', function (done) {
			shell.cd(path.dirname(updateddir));
			updateddir = './' + path.basename(updateddir);
			return underTest({source: updateddir}).then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
			}).then(function () {
				return invoke('latest/echo?name=mike');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'latest'
				});
			}).then(done, done.fail);
		});

		it('works with non-reentrant modules', function (done) {
			global.MARKED = false;
			shell.cp('-rf', 'spec/test-projects/non-reentrant/*', updateddir);
			underTest({source: updateddir}).then(done, done.fail);
		});
		it('when the version is provided, creates the deployment with that name', function (done) {
			underTest({source: updateddir, version: 'development'}).then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/development');
			}).then(function () {
				return invoke('development/echo?name=mike');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'development'
				});
			}).then(done, done.fail);
		});
		it('adds an api config cache if requested', function (done) {
			underTest({source: updateddir, version: 'development', 'cache-api-config': 'claudiaConfig'}).then(function (result) {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/development');
			}).then(function () {
				return invoke('development/echo?name=mike');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'development',
					claudiaConfig: 'nWvdJ3sEScZVJeZSDq4LZtDsCZw9dDdmsJbkhnuoZIY='
				});
			}).then(done, done.fail);
		});
		it('if using a different version, leaves the old one intact', function (done) {
			underTest({source: updateddir, version: 'development'}).then(function () {
				return invoke('original/hello');
			}).then(function (contents) {
				expect(contents.body).toEqual('"hello world"');
			}).then(done, done.fail);
		});
		it('if using the same version, rewrites the old one', function (done) {
			underTest({source: updateddir, version: 'original'}).then(function () {
				return invoke('original/echo?name=mike');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'original'
				});
			}).then(done, done.fail);
		});

		it('executes post-deploy if provided with the api', function (done) {
			shell.cp('-rf', 'spec/test-projects/api-gw-postdeploy/*', updateddir);
			underTest({
				source: updateddir,
				version: 'development',
				postcheck: 'option-123',
				postresult: 'option-result-post'
			}).then(function (updateResult) {
				expect(updateResult.deploy).toEqual('option-result-post');
			}).then(function () {
				return invoke('postdeploy/hello');
			}).then(function (contents) {
				expect(JSON.parse(contents.body)).toEqual({
					'postinstallfname': testRunName,
					'postinstallalias': 'development',
					'postinstallapiid': newObjects.restApi,
					'hasPromise': 'true',
					'postinstallapiUrl': 'https://' + newObjects.restApi + '.execute-api.us-east-1.amazonaws.com/development',
					'hasAWS': 'true',
					'postinstallregion': awsRegion,
					'postinstalloption': 'option-123',
					'lambdaVersion': 'development'
				});
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail();
			});
		});

	});
	it('logs call execution', function (done) {
		var logger = new ArrayLogger();
		shell.cp('-r', 'spec/test-projects/api-gw-hello-world/', workingdir);
		create({name: testRunName, region: awsRegion, source: workingdir, 'api-module': 'main'}).then(function (result) {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.restApi = result.api && result.api.id;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(function () {
			return underTest({source: workingdir, version: 'new'}, logger);
		}).then(function () {
			expect(logger.getStageLog(true).filter(function (entry) {
					return entry !== 'rate-limited by AWS, waiting before retry';
				})).toEqual([
					'loading Lambda config', 'packaging files', 'validating package', 'zipping package', 'updating Lambda', 'setting version alias', 'updating REST API'
				]);
			expect(logger.getApiCallLogForService('lambda', true)).toEqual([
					'lambda.getFunctionConfiguration', 'lambda.updateFunctionCode', 'lambda.updateAlias', 'lambda.createAlias'
			]);
			expect(logger.getApiCallLogForService('iam', true)).toEqual([]);
			expect(logger.getApiCallLogForService('sts', true)).toEqual(['sts.getCallerIdentity']);
			expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
				'apigateway.getRestApi',
				'apigateway.getResources',
				'apigateway.deleteResource',
				'apigateway.createResource',
				'apigateway.putMethod',
				'apigateway.putIntegration',
				'apigateway.putMethodResponse',
				'apigateway.putIntegrationResponse',
				'apigateway.createDeployment'
			]);
		}).then(done, done.fail);
	});
});
