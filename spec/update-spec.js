/*global describe, require, it, expect, beforeEach, afterEach, console, global, __dirname */
const underTest = require('../src/commands/update'),
	limits = require('../src/util/limits.json'),
	destroyObjects = require('./util/destroy-objects'),
	create = require('../src/commands/create'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	ArrayLogger = require('../src/util/array-logger'),
	fs = require('fs'),
	fsPromise = require('../src/util/fs-promise'),
	fsUtil = require('../src/util/fs-util'),
	path = require('path'),
	aws = require('aws-sdk'),
	os = require('os'),
	awsRegion = require('./util/test-aws-region');
describe('update', () => {
	'use strict';
	let workingdir, testRunName,  lambda, newObjects;
	const invoke = function (url, options) {
			if (!options) {
				options = {};
			}
			options.retry = 403;
			return callApi(newObjects.restApi, awsRegion, url, options);
		},
		getLambdaConfiguration = function (qualifier) {
			return lambda.getFunctionConfiguration({ FunctionName: testRunName, Qualifier: qualifier }).promise();
		};
	beforeEach(() => {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		lambda = new aws.Lambda({region: awsRegion});
		newObjects = {workingdir: workingdir};
		fs.mkdirSync(workingdir);
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the source dir does not contain the project config file', done => {
		underTest({source: workingdir}).then(done.fail, reason => {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails if the source folder is same as os tmp folder', done => {
		fsUtil.copy('spec/test-projects/hello-world', os.tmpdir(), true);
		fs.writeFileSync(path.join(os.tmpdir(), 'claudia.json'), JSON.stringify({lambda: {name: 'xxx', region: 'us-east-1'}}), 'utf8');
		underTest({source: os.tmpdir()}).then(done.fail, message => {
			expect(message).toEqual('Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({source: workingdir}).then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest({source: workingdir}).then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	it('fails if local dependencies and optional dependencies are mixed', done => {
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		underTest({source: workingdir, 'use-local-dependencies': true, 'optional-dependencies': false}).then(done.fail, message => {
			expect(message).toEqual('incompatible arguments --use-local-dependencies and --no-optional-dependencies');
			done();
		});
	});

	describe('when the config exists', () => {
		beforeEach(done => {
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				fsUtil.copy('spec/test-projects/echo', workingdir, true);
			}).then(done, done.fail);
		});
		it('fails if the lambda no longer exists', done => {
			fsPromise.readFileAsync(path.join(workingdir, 'claudia.json'), 'utf8')
			.then(JSON.parse)
			.then(contents => {
				contents.lambda.name = contents.lambda.name + '-xxx';
				return contents;
			}).then(JSON.stringify)
			.then(contents => {
				return fsPromise.writeFileAsync(path.join(workingdir, 'claudia.json'), contents, 'utf8');
			}).then(() => {
				return underTest({source: workingdir});
			}).then(done.fail, reason => {
				expect(reason.code).toEqual('ResourceNotFoundException');
			}).then(done);
		});
		it('validates the package before updating the lambda', done => {
			fsUtil.copy('spec/test-projects/echo-dependency-problem', workingdir, true);
			underTest({source: workingdir})
			.then(done.fail, reason => {
				expect(reason).toEqual('cannot require ./main after clean installation. Check your dependencies.');
			}).then(() => {
				return lambda.listVersionsByFunction({FunctionName: testRunName}).promise();
			}).then(result => {
				expect(result.Versions.length).toEqual(2);
			}).then(done, done.fail);
		});
		it('creates a new version of the lambda function', done => {
			underTest({source: workingdir}).then(lambdaFunc => {
				expect(new RegExp('^arn:aws:lambda:' + awsRegion + ':[0-9]+:function:' + testRunName + ':2$').test(lambdaFunc.FunctionArn)).toBeTruthy();
			}).then(() => {
				return lambda.listVersionsByFunction({FunctionName: testRunName}).promise();
			}).then(result => {
				expect(result.Versions.length).toEqual(3);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
				expect(result.Versions[2].Version).toEqual('2');
			}).then(done, done.fail);
		});
		it('updates the lambda with a new version', done => {
			underTest({source: workingdir}).then(() => {
				return lambda.invoke({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})}).promise();
			}).then(lambdaResult => {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"message":"aloha"}');
			}).then(done, done.fail);
		});

		it('keeps the archive on the disk if --keep is specified', done => {
			underTest({source: workingdir, keep: true}).then(result => {
				expect(result.archive).toBeTruthy();
				expect(fsUtil.isFile(result.archive)).toBeTruthy();
			}).then(done, done.fail);
		});

		it('uses local dependencies if requested', done => {
			fsUtil.copy(path.join(__dirname, 'test-projects', 'local-dependencies'), workingdir, true);
			fsUtil.silentRemove(path.join(workingdir, 'node_modules'));
			fs.mkdirSync(path.join(workingdir, 'node_modules'));
			fsUtil.copy(path.join(workingdir, 'local_modules'),  path.join(workingdir, 'node_modules'), true);

			underTest({source: workingdir, 'use-local-dependencies': true}).then(() => {
				return lambda.invoke({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})}).promise();
			}).then(lambdaResult => {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello local"');
			}).then(done, done.fail);
		});
		it('removes optional dependencies after validation if requested', done => {
			fsUtil.copy(path.join(__dirname, '/test-projects/optional-dependencies'), workingdir, true);
			underTest({source: workingdir, 'optional-dependencies': false}).then(() => {
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(lambdaResult => {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"endpoint":"https://s3.amazonaws.com/","modules":[".bin","huh"]}');
			}).then(done, done.fail);
		});
		it('rewires relative dependencies to reference original location after copy', done => {
			fsUtil.copy(path.join(__dirname, 'test-projects/relative-dependencies'), workingdir, true);
			fsUtil.copy(path.join(workingdir, 'claudia.json'), path.join(workingdir, 'lambda'));
			underTest({source: path.join(workingdir, 'lambda')}).then(() => {
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(lambdaResult => {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello relative"');
			}).then(done, done.fail);
		});

		it('uses a s3 bucket if provided', done => {
			const s3 = new aws.S3(),
				logger = new ArrayLogger(),
				bucketName = testRunName + '-bucket';
			let archivePath;
			s3.createBucket({
				Bucket: bucketName
			}).promise().then(() => {
				newObjects.s3bucket = bucketName;
			}).then(() => {
				return underTest({keep: true, 'use-s3-bucket': bucketName, source: workingdir}, logger);
			}).then(result => {
				const expectedKey = path.basename(result.archive);
				archivePath = result.archive;
				expect(result.s3key).toEqual(expectedKey);
				return s3.headObject({
					Bucket: bucketName,
					Key: expectedKey
				}).promise();
			}).then(fileResult => {
				expect(parseInt(fileResult.ContentLength)).toEqual(fs.statSync(archivePath).size);
			}).then(() => {
				expect(logger.getApiCallLogForService('s3', true)).toEqual(['s3.upload', 's3.getSignatureVersion']);
			}).then(() => {
				return lambda.invoke({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})}).promise();
			}).then(lambdaResult => {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"message":"aloha"}');
			}).then(done, done.fail);
		});

		it('uses a s3 bucket with server side encryption if provided', done => {
			const s3 = new aws.S3(),
				logger = new ArrayLogger(),
				bucketName = testRunName + '-bucket',
				serverSideEncryption = 'AES256';
			let archivePath;
			s3.createBucket({
				Bucket: bucketName
			}).promise().then(() => {
				newObjects.s3bucket = bucketName;
			}).then(() => {
				return s3.putBucketEncryption({
					Bucket: bucketName,
					ServerSideEncryptionConfiguration: {
						Rules: [
							{
								ApplyServerSideEncryptionByDefault: {
									SSEAlgorithm: 'AES256'
								}
							}
						]
					}
				}).promise();
			}).then(() => {
				return s3.putBucketPolicy({
					Bucket: bucketName,
					Policy: `{
						"Version": "2012-10-17",
						"Statement":  [
							{
								"Sid": "S3Encryption",
								"Action": [ "s3:PutObject" ],
								"Effect": "Deny",
								"Resource": "arn:aws:s3:::${bucketName}/*",
								"Principal": "*",
								"Condition": {
									"Null": {
										"s3:x-amz-server-side-encryption": true
									}
								}
							}
						]
					}`
				}).promise();
			}).then(() => {
				return underTest({keep: true, 'use-s3-bucket': bucketName, 's3-sse': serverSideEncryption, source: workingdir}, logger);
			}).then(result => {
				const expectedKey = path.basename(result.archive);
				archivePath = result.archive;
				expect(result.s3key).toEqual(expectedKey);
				return s3.headObject({
					Bucket: bucketName,
					Key: expectedKey
				}).promise();
			}).then(fileResult => {
				expect(parseInt(fileResult.ContentLength)).toEqual(fs.statSync(archivePath).size);
			}).then(() => {
				expect(logger.getApiCallLogForService('s3', true)).toEqual(['s3.upload', 's3.getSignatureVersion']);
			}).then(() => {
				return lambda.invoke({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})}).promise();
			}).then(lambdaResult => {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"message":"aloha"}');
			}).then(done, done.fail);
		});

		it('adds the version alias if supplied', done => {
			underTest({source: workingdir, version: 'great'}).then(() => {
				return lambda.getAlias({FunctionName: testRunName, Name: 'great'}).promise();
			}).then(result => {
				expect(result.FunctionVersion).toEqual('2');
			}).then(done, done.fail);
		});

		it('checks the current dir if the source is not provided', done => {
			process.chdir(workingdir);
			underTest().then(lambdaFunc => {
				expect(new RegExp('^arn:aws:lambda:' + awsRegion + ':[0-9]+:function:' + testRunName + ':2$').test(lambdaFunc.FunctionArn)).toBeTruthy();
				expect(lambdaFunc.FunctionName).toEqual(testRunName);
				return lambda.invoke({FunctionName: testRunName, Payload: JSON.stringify({message: 'aloha'})}).promise();
			}).then(done, done.fail);
		});
	});
	describe('when the lambda project contains a proxy api', () => {
		beforeEach(done => {
			fsUtil.copy('spec/test-projects/apigw-proxy-echo', workingdir, true);
			create({name: testRunName, version: 'original', region: awsRegion, source: workingdir, handler: 'main.handler', 'deploy-proxy-api': true}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
			}).then(done, done.fail);
		});
		it('if using a different version, deploys a new stage', done => {
			underTest({source: workingdir, version: 'development'}).then(result => {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/development');
			}).then(() => {
				return invoke('development/hello?abc=def');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({abc: 'def'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.path).toEqual('/hello');
				expect(params.requestContext.stage).toEqual('development');
			}).then(done, e => {
				console.log(e);
				done.fail();
			});
		});
	});
	describe('when the lambda project contains a web api', () => {
		let originaldir, updateddir;
		beforeEach(done => {
			originaldir =  path.join(workingdir, 'original');
			updateddir = path.join(workingdir, 'updated');
			fs.mkdirSync(originaldir);
			fs.mkdirSync(updateddir);
			fsUtil.copy('spec/test-projects/api-gw-hello-world', originaldir, true);
			fsUtil.copy('spec/test-projects/api-gw-echo', updateddir, true);
			create({name: testRunName, version: 'original', region: awsRegion, source: originaldir, 'api-module': 'main'}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
				fsUtil.copy(path.join(originaldir, 'claudia.json'), updateddir);
			}).then(done, done.fail);
		});
		it('fails if the api no longer exists', done => {
			fsPromise.readFileAsync(path.join(updateddir, 'claudia.json'), 'utf8')
			.then(JSON.parse)
			.then(contents => {
				contents.api.id = contents.api.id + '-xxx';
				return contents;
			}).then(JSON.stringify)
			.then(contents => {
				return fsPromise.writeFileAsync(path.join(updateddir, 'claudia.json'), contents, 'utf8');
			}).then(() => {
				return underTest({source: updateddir});
			}).then(done.fail, reason => {
				expect(reason.code).toEqual('NotFoundException');
			}).then(() => {
				return lambda.listVersionsByFunction({FunctionName: testRunName}).promise();
			}).then(result => {
				expect(result.Versions.length).toEqual(2);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
			}).then(done, done.fail);
		});
		it('validates the package before creating a new lambda version', done => {
			fsUtil.copy('spec/test-projects/echo-dependency-problem', updateddir, true);
			underTest({source: updateddir}).then(done.fail, reason => {
				expect(reason).toEqual('cannot require ./main after clean installation. Check your dependencies.');
			}).then(() => {
				return lambda.listVersionsByFunction({FunctionName: testRunName}).promise();
			}).then(result => {
				expect(result.Versions.length).toEqual(2);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
			}).then(done, done.fail);
		});


		it('updates the api using the configuration from the api module', done => {
			return underTest({source: updateddir}).then(result => {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
			}).then(() => {
				return invoke('latest/echo?name=mike');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'latest'
				});
			}).then(done, done.fail);
		});
		it('upgrades the function handler from 1.x', done => {
			lambda.updateFunctionConfiguration({
				FunctionName: testRunName,
				Handler: 'main.router'
			}).promise().then(() => {
				return underTest({source: updateddir});
			}).then(result => {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
			}).then(() => {
				return invoke('latest/echo?name=mike');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'latest'
				});
			}).then(done, done.fail);
		});

		it('works when the source is a relative path', done => {
			process.chdir(path.dirname(updateddir));
			updateddir = './' + path.basename(updateddir);
			return underTest({source: updateddir}).then(result => {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
			}).then(() => {
				return invoke('latest/echo?name=mike');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'latest'
				});
			}).then(done, done.fail);
		});

		it('works with non-reentrant modules', done => {
			global.MARKED = false;
			fsUtil.copy('spec/test-projects/non-reentrant', updateddir, true);
			underTest({source: updateddir}).then(done, done.fail);
		});
		it('when the version is provided, creates the deployment with that name', done => {
			underTest({source: updateddir, version: 'development'}).then(result => {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/development');
			}).then(() => {
				return invoke('development/echo?name=mike');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'development'
				});
			}).then(done, done.fail);
		});
		it('adds an api config cache if requested', done => {
			underTest({source: updateddir, version: 'development', 'cache-api-config': 'claudiaConfig'}).then(result => {
				expect(result.url).toEqual('https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/development');
			}).then(() => {
				return invoke('development/echo?name=mike');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'development',
					claudiaConfig: '-EDMbG0OcNlCZzstFc2jH6rlpI1YDlNYc9YGGxUFuXo='
				});
			}).then(done, done.fail);
		});
		it('if using a different version, leaves the old one intact', done => {
			underTest({source: updateddir, version: 'development'}).then(() => {
				return invoke('original/hello');
			}).then(contents => {
				expect(contents.body).toEqual('"hello world"');
			}).then(done, done.fail);
		});
		it('if using the same version, rewrites the old one', done => {
			underTest({source: updateddir, version: 'original'}).then(() => {
				return invoke('original/echo?name=mike');
			}).then(contents => {
				const params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({name: 'mike'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.requestContext.resourcePath).toEqual('/echo');
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'original'
				});
			}).then(done, done.fail);
		});

		it('executes post-deploy if provided with the api', done => {
			fsUtil.copy('spec/test-projects/api-gw-postdeploy', updateddir, true);
			underTest({
				source: updateddir,
				version: 'development',
				postcheck: 'option-123',
				postresult: 'option-result-post'
			}).then(updateResult => {
				expect(updateResult.deploy).toEqual({
					result: 'option-result-post',
					wasApiCacheUsed: false
				});
			}).then(() => {
				return invoke('postdeploy/hello');
			}).then(contents => {
				expect(JSON.parse(contents.body)).toEqual({
					'postinstallfname': testRunName,
					'postinstallalias': 'development',
					'postinstallapiid': newObjects.restApi,
					'postinstallapiUrl': 'https://' + newObjects.restApi + '.execute-api.' + awsRegion + '.amazonaws.com/development',
					'hasAWS': 'true',
					'postinstallregion': awsRegion,
					'postinstalloption': 'option-123',
					'lambdaVersion': 'development'
				});
			}).then(done, e => {
				console.log(JSON.stringify(e));
				done.fail();
			});
		});
		it('passes cache check results to the post-deploy step', done => {
			fsUtil.copy('spec/test-projects/api-gw-postdeploy', updateddir, true);
			underTest({
				source: updateddir,
				version: 'development',
				postcheck: 'option-123',
				'cache-api-config': 'claudiaConfig',
				postresult: 'option-result-post'
			}).then(updateResult => {
				expect(updateResult.deploy.wasApiCacheUsed).toBeFalsy();
				return underTest({
					source: updateddir,
					version: 'development',
					postcheck: 'option-123',
					'cache-api-config': 'claudiaConfig',
					postresult: 'option-result-post'
				});
			}).then(updateResult => {
				expect(updateResult.deploy.wasApiCacheUsed).toBeTruthy();
			}).then(done, done.fail);
		});
	});
	it('logs call execution', done => {
		const logger = new ArrayLogger();
		fsUtil.copy('spec/test-projects/api-gw-hello-world', workingdir, true);
		create({name: testRunName, region: awsRegion, source: workingdir, 'api-module': 'main'}).then(result => {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.restApi = result.api && result.api.id;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(() => {
			return underTest({source: workingdir, version: 'new'}, logger);
		}).then(() => {
			expect(logger.getStageLog(true).filter(entry => {
				return entry !== 'rate-limited by AWS, waiting before retry';
			})).toEqual([
				'loading Lambda config',
				'packaging files',
				'validating package',
				'updating configuration',
				'zipping package',
				'updating Lambda',
				'setting version alias',
				'updating REST API'
			]);
			expect(logger.getApiCallLogForService('lambda', true)).toEqual([
				'lambda.getFunctionConfiguration', 'lambda.setupRequestListeners', 'lambda.updateFunctionCode', 'lambda.updateAlias', 'lambda.createAlias'
			]);
			expect(logger.getApiCallLogForService('iam', true)).toEqual([]);
			expect(logger.getApiCallLogForService('sts', true)).toEqual(['sts.getCallerIdentity']);
			expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
				'apigateway.getRestApi',
				'apigateway.setupRequestListeners',
				'apigateway.setAcceptHeader',
				'apigateway.putRestApi',
				'apigateway.getResources',
				'apigateway.createResource',
				'apigateway.putMethod',
				'apigateway.putIntegration',
				'apigateway.putMethodResponse',
				'apigateway.putIntegrationResponse',
				'apigateway.createDeployment'
			]);
		}).then(done, done.fail);
	});
	describe('handler option support', () => {
		beforeEach(done => {
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			create({name: testRunName, timeout: 10, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('does not change the handler if not provided', done => {
			underTest({source: workingdir, version: 'new'})
			.then(() => getLambdaConfiguration('new'))
			.then(configuration => expect(configuration.Handler).toEqual('main.handler'))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.Handler).toEqual('main.handler'))
			.then(done, done.fail);
		});
		it('can specify the new handler --handler argument', done => {
			fsUtil.copy('spec/test-projects/api-gw-echo', workingdir, true);
			underTest({source: workingdir, version: 'new', handler: 'main.proxyRouter'})
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.Handler).toEqual('main.proxyRouter'))
			.then(() => getLambdaConfiguration('new'))
			.then(configuration => expect(configuration.Handler).toEqual('main.proxyRouter'))
			.then(done, done.fail);
		});
		it('fails if the lambda code does not export the handler', done => {
			underTest({source: workingdir, version: 'new', handler: 'main.proxyRouter'})
			.then(() => done.fail('update succeeded'), error => expect(error).toEqual('main.js does not export method proxyRouter'))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.Handler).toEqual('main.handler'))
			.then(done, done.fail);
		});

	});

	describe('timeout option support', () => {
		beforeEach(done => {
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			create({name: testRunName, timeout: 10, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('does not change the timeout if not provided', done => {
			underTest({source: workingdir, version: 'new'})
			.then(() => getLambdaConfiguration('new'))
			.then(configuration => expect(configuration.Timeout).toEqual(10))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.Timeout).toEqual(10))
			.then(done, done.fail);
		});
		it('fails if timeout value is < 1', done => {
			underTest({source: workingdir, timeout: 0})
			.then(() => done.fail('update succeeded'), error => expect(error).toEqual('the timeout value provided must be greater than or equal to 1'))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.Timeout).toEqual(10))
			.then(done, done.fail);
		});
		it('fails if timeout value is > 900', done => {
			underTest({source: workingdir, version: 'new', timeout: 901})
			.then(() => done.fail('update succeeded'), error => expect(error).toEqual('the timeout value provided must be less than or equal to 900'))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.Timeout).toEqual(10))
			.then(done, done.fail);
		});
		it('can specify timeout using the --timeout argument', done => {
			underTest({source: workingdir, version: 'new', timeout: 40})
			.then(() => getLambdaConfiguration())
			.then(lambdaResult => expect(lambdaResult.Timeout).toEqual(40))
			.then(() => getLambdaConfiguration('new'))
			.then(lambdaResult => expect(lambdaResult.Timeout).toEqual(40))
			.then(done, done.fail);
		});
	});
	describe('runtime', () => {
		beforeEach(done => {
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			create({name: testRunName, runtime: 'nodejs4.3', region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('does not change the runtime if not provided', done => {
			underTest({source: workingdir, version: 'new'})
			.then(() => getLambdaConfiguration('new'))
			.then(lambdaResult => expect(lambdaResult.Runtime).toEqual('nodejs4.3'))
			.then(() => getLambdaConfiguration())
			.then(lambdaResult => expect(lambdaResult.Runtime).toEqual('nodejs4.3'))
			.then(done, done.fail);
		});
		it('can update the runtime when requested', done => {
			underTest({source: workingdir, version: 'new', runtime: 'nodejs6.10'})
			.then(() => getLambdaConfiguration('new'))
			.then(lambdaResult => expect(lambdaResult.Runtime).toEqual('nodejs6.10'))
			.then(() => getLambdaConfiguration())
			.then(lambdaResult => expect(lambdaResult.Runtime).toEqual('nodejs6.10'))
			.then(done, done.fail);
		});
	});
	describe('memory', () => {
		beforeEach(done => {
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			create({name: testRunName, memory: 256, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('does not change the memory if not provided', done => {
			underTest({source: workingdir, version: 'new'})
			.then(() => getLambdaConfiguration('new'))
			.then(configuration => expect(configuration.MemorySize).toEqual(256))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.MemorySize).toEqual(256))
			.then(done, done.fail);
		});
		it(`fails if memory value is < ${limits.LAMBDA.MEMORY.MIN}`, done => {
			underTest({source: workingdir, version: 'new', memory: 64})
			.then(() => done.fail(`update succeeded`), error => expect(error).toEqual(`the memory value provided must be greater than or equal to ${limits.LAMBDA.MEMORY.MIN}`))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.MemorySize).toEqual(256))
			.then(done, done.fail);
		});
		it('fails if memory value is 0', done => {
			underTest({source: workingdir, version: 'new', memory: 0})
				.then(() => done.fail(`update succeeded`), error => expect(error).toEqual(`the memory value provided must be greater than or equal to ${limits.LAMBDA.MEMORY.MIN}`))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.MemorySize).toEqual(256))
			.then(done, done.fail);
		});
		it(`fails if memory value is > ${limits.LAMBDA.MEMORY.MAX}`, done => {
			underTest({source: workingdir, version: 'new', memory: limits.LAMBDA.MEMORY.MAX + 64})
			.then(() => done.fail(`update succeeded`), error => expect(error).toEqual(`the memory value provided must be less than or equal to ${limits.LAMBDA.MEMORY.MAX}`))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.MemorySize).toEqual(256))
			.then(done, done.fail);
		});
		it('fails if memory value is not a multiple of 64', done => {
			underTest({source: workingdir, version: 'new', memory: 130})
			.then(() => done.fail('update succeeded'), error => expect(error).toEqual('the memory value provided must be a multiple of 64'))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.MemorySize).toEqual(256))
			.then(done, done.fail);
		});
		it('can specify memory size using the --memory argument', done => {
			underTest({source: workingdir, version: 'new', memory: limits.LAMBDA.MEMORY.MAX})
			.then(() => getLambdaConfiguration('new'))
			.then(configuration => expect(configuration.MemorySize).toEqual(limits.LAMBDA.MEMORY.MAX))
			.then(() => getLambdaConfiguration())
			.then(configuration => expect(configuration.MemorySize).toEqual(limits.LAMBDA.MEMORY.MAX))
			.then(done, done.fail);
		});
	});
	describe('environment variables', () => {
		let standardEnvKeys, logger;
		const nonStandard = function (key) {
			return standardEnvKeys.indexOf(key) < 0;
		};
		beforeEach(done => {
			logger = new ArrayLogger();
			standardEnvKeys = require('./util/standard-env-keys');
			fsUtil.copy('spec/test-projects/env-vars', workingdir, true);
			create({
				name: testRunName,
				version: 'original',
				region: awsRegion,
				source: workingdir,
				'handler': 'main.handler',
				'set-env': 'XPATH=/var/www,YPATH=/var/lib'
			}).then(result => {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			}).then(done, done.fail);
		});
		it('does not change environment variables if set-env not provided', done => {
			return underTest({source: workingdir, version: 'new'}, logger).then(() => {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'new'
				}).promise();
			}).then(configuration => {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/var/www',
						'YPATH': '/var/lib'
					}
				});
			}).then(() => {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(result => {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'YPATH']);
				expect(env.XPATH).toEqual('/var/www');
				expect(env.YPATH).toEqual('/var/lib');
			}).then(done, done.fail);
		});
		it('changes environment variables if set-env is provided', done => {
			return underTest({source: workingdir, version: 'new', 'set-env': 'XPATH=/opt,ZPATH=/usr'}, logger).then(() => {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'new'
				}).promise();
			}).then(configuration => {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/opt',
						'ZPATH': '/usr'
					}
				});
			}).then(() => {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(result => {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'ZPATH']);
				expect(env.XPATH).toEqual('/opt');
				expect(env.YPATH).toBeFalsy();
				expect(env.ZPATH).toEqual('/usr');
			}).then(done, done.fail);
		});
		it('merges env variables if update-env is provided', done => {
			return underTest({source: workingdir, version: 'new', 'update-env': 'XPATH=/opt,ZPATH=/usr'})
			.then(() => getLambdaConfiguration('new'))
			.then(configuration => {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/opt',
						'YPATH': '/var/lib',
						'ZPATH': '/usr'
					}
				});
			}).then(() => {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(result => {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'YPATH', 'ZPATH']);
				expect(env.XPATH).toEqual('/opt');
				expect(env.YPATH).toEqual('/var/lib');
				expect(env.ZPATH).toEqual('/usr');
			}).then(done, done.fail);

		});
		it('changes env variables specified in a JSON file', done => {
			const envpath = path.join(workingdir, 'env.json');
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/opt', 'ZPATH': '/usr'}), 'utf8');
			return underTest({source: workingdir, version: 'new', 'set-env-from-json': envpath}, logger).then(() => {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'new'
				}).promise();
			}).then(configuration => {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/opt',
						'ZPATH': '/usr'
					}
				});
			}).then(() => {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(result => {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'ZPATH']);
				expect(env.XPATH).toEqual('/opt');
				expect(env.YPATH).toBeFalsy();
				expect(env.ZPATH).toEqual('/usr');
			}).then(done, done.fail);
		});
		it('updates env variables specified in a JSON file if update-env-from-json is provided', done => {
			const envpath = path.join(workingdir, 'env.json');
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/opt', 'ZPATH': '/usr'}), 'utf8');
			return underTest({source: workingdir, version: 'new', 'update-env-from-json': envpath}, logger).then(() => {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName,
					Qualifier: 'new'
				}).promise();
			}).then(configuration => {
				expect(configuration.Environment).toEqual({
					Variables: {
						'XPATH': '/opt',
						'YPATH': '/var/lib',
						'ZPATH': '/usr'
					}
				});
			}).then(() => {
				return lambda.invoke({
					FunctionName: testRunName,
					Qualifier: 'new',
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(result => {
				const env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'YPATH', 'ZPATH']);
				expect(env.XPATH).toEqual('/opt');
				expect(env.YPATH).toEqual('/var/lib');
				expect(env.ZPATH).toEqual('/usr');
			}).then(done, done.fail);
		});

		it('refuses to work if reading the variables fails', done => {
			return underTest({source: workingdir, version: 'new', 'set-env': 'XPATH,ZPATH=/usr'}, logger).then(done.fail, message => {
				expect(message).toEqual('Cannot read variables from set-env, Invalid CSV element XPATH');
				expect(logger.getApiCallLogForService('lambda', true)).toEqual([]);
				expect(logger.getApiCallLogForService('iam', true)).toEqual([]);
				done();
			});
		});

		it('loads up the environment variables while validating the package to allow any code that expects them to initialize -- fix for https://github.com/claudiajs/claudia/issues/96', done => {
			fsUtil.copy('spec/test-projects/throw-if-not-env', workingdir, true);
			process.env.TEST_VAR = '';
			underTest({source: workingdir, version: 'new', 'set-env': 'TEST_VAR=abc'}, logger).then(done, done.fail);
		});

	});
});
