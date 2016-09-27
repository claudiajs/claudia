/*global describe, require, it, expect, beforeEach, afterEach, console, jasmine, __dirname, global */
var underTest = require('../src/commands/create'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	templateFile = require('../src/util/template-file'),
	ArrayLogger = require('../src/util/array-logger'),
	shell = require('shelljs'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs')),
	retriableWrap = require('../src/util/retriable-wrap'),
	path = require('path'),
	os = require('os'),
	aws = require('aws-sdk'),
	awsRegion = 'us-east-1';
describe('create', function () {
	'use strict';
	var workingdir, testRunName, iam, lambda, newObjects, config,logs,
		createFromDir = function (dir, logger) {
			if (!shell.test('-e', workingdir)) {
				shell.mkdir('-p', workingdir);
			}
			shell.cp('-r', path.join(__dirname, 'test-projects/', (dir || 'hello-world')) + '/*', workingdir);
			return underTest(config, logger).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = (result.api && result.api.id) || (result.proxyApi && result.proxyApi.id);
				return result;
			});
		};

	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = Promise.promisifyAll(new aws.IAM());
		lambda = Promise.promisifyAll(new aws.Lambda({region: awsRegion}), {suffix: 'Promise'});
		logs = new aws.CloudWatchLogs({region: awsRegion});
		newObjects = {workingdir: workingdir};
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
		config = {name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'};
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).catch(function (err) {
			console.log('error cleaning up', err);
		}).finally(done);
	});
	describe('config validation', function () {
		it('fails if the source folder is same as os tmp folder', function (done) {
			config.source = os.tmpdir();
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.');
				done();
			});
		});
		it('fails if name is not given either as an option or package.json name', function (done) {
			shell.mkdir(workingdir);
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			fs.writeFileSync(path.join(workingdir, 'package.json'), '{"name": ""}', 'utf8');
			config.name = undefined;
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('project name is missing. please specify with --name or in package.json');
				done();
			});
		});
		it('fails if the region is not given', function (done) {
			config.region = undefined;
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('AWS region is missing. please specify with --region');
				done();
			});
		});
		it('fails if the handler is not given', function (done) {
			config.handler = undefined;
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('Lambda handler is missing. please specify with --handler');
				done();
			});
		});
		it('fails if the handler contains a folder', function (done) {
			config.handler = 'api/main.router';
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('Lambda handler module has to be in the main project directory');
			}).then(done);
		});
		it('fails if both handler and api module are provided', function (done) {
			config.handler = 'main.handler';
			config['api-module'] = 'main';
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('incompatible arguments: cannot specify handler and api-module at the same time.');
			}).then(done);
		});
		it('fails if deploy-proxy-api is specified but handler is not', function (done) {
			config['deploy-proxy-api'] = true;
			config.handler = undefined;
			config['api-module'] = 'abc';
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('deploy-proxy-api requires a handler. please specify with --handler');
			}).then(done);
		});
		it('fails if the api module contains a folder', function (done) {
			config.handler = undefined;
			config['api-module'] = 'api/main';
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('API module has to be in the main project directory');
			}).then(done);
		});

		it('fails if claudia.json already exists in the source folder', function (done) {
			shell.mkdir(workingdir);
			fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('claudia.json already exists in the source folder');
				done();
			});
		});
		it('works if claudia.json already exists in the source folder but alternative config provided', function (done) {
			shell.mkdir(workingdir);
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
			shell.cd(workingdir);
			config.config = 'lambda.json';
			underTest(config).then(done, done.fail);
		});
		it('fails if the alternative config is provided but the file already exists', function (done) {
			shell.mkdir(workingdir);
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			fs.writeFileSync(path.join(workingdir, 'lambda.json'), '{}', 'utf8');
			shell.cd(workingdir);
			config.config = 'lambda.json';
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('lambda.json already exists');
				done();
			});
		});
		it('checks the current folder if the source parameter is not defined', function (done) {
			shell.mkdir(workingdir);
			shell.cd(workingdir);
			fs.writeFileSync(path.join('claudia.json'), '{}', 'utf8');
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('claudia.json already exists in the source folder');
				done();
			});
		});
		it('fails if package.json does not exist in the target folder', function (done) {
			shell.mkdir(workingdir);
			shell.cp('-r', 'spec/test-projects/hello-world/*', workingdir);
			shell.rm(path.join(workingdir, 'package.json'));
			underTest(config).then(done.fail, function (message) {
				expect(message).toEqual('package.json does not exist in the source folder');
				done();
			});
		});
		it('fails if local dependencies and optional dependencies are mixed', function (done) {
			config['use-local-dependencies'] = true;
			config['no-optional-dependencies'] = true;
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('incompatible arguments --use-local-dependencies and --no-optional-dependencies');
				done();
			});
		});
		it('validates the package before creating the role or the function', function (done) {
			createFromDir('echo-dependency-problem').then(function () {
				done.fail('create succeeded');
			}, function (reason) {
				expect(reason).toEqual('cannot require ./main after npm install --production. Check your dependencies.');
			}).then(function () {
				return iam.getRoleAsync({RoleName: testRunName + '-executor'}).then(function () {
					done.fail('iam role was created');
				}, function () {});
			}).then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName}).then(function () {
					done.fail('function was created');
				}, function () {});
			}).
			then(done);
		});
	});
	describe('role management', function () {
		it('creates the IAM role for the lambda', function (done) {
			createFromDir('hello-world').then(function () {
				return iam.getRoleAsync({RoleName: testRunName + '-executor'});
			}).then(function (role) {
				expect(role.Role.RoleName).toEqual(testRunName + '-executor');
			}).then(done, done.fail);
		});
		it('does not create a role if the role option is provided, uses the provided one instead', function (done) {
			var createdRole;

			return fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
			.then(function (lambdaRolePolicy) {
				return iam.createRoleAsync({
					RoleName: testRunName + '-manual',
					AssumeRolePolicyDocument: lambdaRolePolicy
				});
			}).then(function (result) {
				createdRole = result.Role;
				config.role = testRunName + '-manual';
				return createFromDir('hello-world');
			}).then(function (createResult) {
				expect(createResult.lambda.role).toEqual(testRunName + '-manual');
			}).then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaMetadata) {
				expect(lambdaMetadata.Role).toEqual(createdRole.Arn);
			}).then(function () {
				return iam.getRoleAsync({RoleName: testRunName + '-executor'});
			}).then(function () {
					done.fail('Executor role was created');
				},
				done);
		});
		it('allows the function to log to cloudwatch', function (done) {
			var createLogGroup = Promise.promisify(logs.createLogGroup.bind(logs)),
				createLogStream = Promise.promisify(logs.createLogStream.bind(logs)),
				getLogEvents = Promise.promisify(logs.getLogEvents.bind(logs));
			createLogGroup({logGroupName: testRunName + '-group'}).then(function () {
				newObjects.logGroup = testRunName + '-group';
				return createLogStream({logGroupName: testRunName + '-group', logStreamName: testRunName + '-stream'});
			}).then(function () {
				return createFromDir('cloudwatch-log');
			}).then(function () {
				return lambda.invokePromise({
					FunctionName: testRunName,
					Payload: JSON.stringify({
						region: awsRegion,
						stream: testRunName + '-stream',
						group: testRunName + '-group',
						message: 'hello ' + testRunName
					})
				});
			}).then(function () {
				return getLogEvents({logGroupName: testRunName + '-group', logStreamName: testRunName + '-stream'});
			}).then(function (logEvents) {
				expect(logEvents.events.length).toEqual(1);
				expect(logEvents.events[0].message).toEqual('hello ' + testRunName);
			}).then(done, done.fail);
		});
		it('allows function to call itself if --allow-recursion is specified', function (done) {
			config['allow-recursion'] = true;
			createFromDir('hello-world').then(function () {
				return iam.listRolePoliciesAsync({RoleName: testRunName + '-executor'});
			}).then(function (result) {
				expect(result.PolicyNames).toEqual(['log-writer', 'recursive-execution']);
			}).then(function () {
				return iam.getRolePolicyAsync({PolicyName: 'recursive-execution', RoleName:  testRunName + '-executor'});
			}).then(function (policy) {
				expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(
						{
							'Version': '2012-10-17',
							'Statement': [{
								'Sid': 'InvokePermission',
								'Effect': 'Allow',
								'Action': [
									'lambda:InvokeFunction'
								],
								'Resource': 'arn:aws:lambda:us-east-1:*:function:' + testRunName
							}]
						});
			}).then(done, function (e) {
				console.log(e);
				done.fail();
			});
		});

		it('loads additional policies from a policies directory recursively, if provided', function (done) {
			var sesPolicy = {
					'Version': '2012-10-17',
					'Statement': [{
						'Effect': 'Allow',
						'Action': [
							'ses:SendEmail'
						],
						'Resource': ['*']
					}]
				},
				policiesDir = path.join(workingdir, 'policies');
			shell.mkdir('-p', path.join(policiesDir, 'subdir'));
			fs.writeFileSync(path.join(workingdir, 'policies', 'subdir', 'ses policy.json'), JSON.stringify(sesPolicy), 'utf8');
			config.policies = policiesDir;
			createFromDir('hello-world').then(function () {
				return iam.listRolePoliciesAsync({RoleName: testRunName + '-executor'});
			}).then(function (result) {
				expect(result.PolicyNames).toEqual(['log-writer', 'ses-policy-json']);
			}).then(function () {
				return iam.getRolePolicyAsync({PolicyName: 'ses-policy-json', RoleName:  testRunName + '-executor'});
			}).then(function (policy) {
				expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(sesPolicy);
			}).then(done, done.fail);
		});
		it('loads additional policies from a file pattern, if provided', function (done) {
			var sesPolicy = {
					'Version': '2012-10-17',
					'Statement': [{
						'Effect': 'Allow',
						'Action': [
							'ses:SendEmail'
						],
						'Resource': ['*']
					}]
				},
				policiesDir = path.join(workingdir, 'policies');
			shell.mkdir('-p', path.join(policiesDir));
			fs.writeFileSync(path.join(workingdir, 'policies', 'ses policy.json'), JSON.stringify(sesPolicy), 'utf8');
			config.policies = path.join(policiesDir, '*.json');
			createFromDir('hello-world').then(function () {
				return iam.listRolePoliciesAsync({RoleName: testRunName + '-executor'});
			}).then(function (result) {
				expect(result.PolicyNames).toEqual(['log-writer', 'ses-policy-json']);
			}).then(function () {
				return iam.getRolePolicyAsync({PolicyName: 'ses-policy-json', RoleName:  testRunName + '-executor'});
			}).then(function (policy) {
				expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(sesPolicy);
			}).then(done, done.fail);
		});
		it('fails if the policies argument does not match any files', function (done) {
			config.policies = path.join('*.NOT');
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('no files match additional policies (*.NOT)');
			}).then(function () {
				return iam.getRoleAsync({RoleName: testRunName + '-executor'}).then(function () {
					done.fail('iam role was created');
				}, function () {});
			}).then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName}).then(function () {
					done.fail('function was created');
				}, function () {});
			}).then(done);
		});
	});
	describe('runtime support', function () {
		it('creates node 4.3 deployments by default', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.Runtime).toEqual('nodejs4.3');
			}).then(done, done.fail);
		});
		it('can create legacy 0.10 deployments using the --runtime argument', function (done) {
			config.runtime = 'nodejs';
			createFromDir('hello-world').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.Runtime).toEqual('nodejs');
			}).then(done, done.fail);
		});
	});
	describe('memory option support', function () {
		it('fails if memory value is < 128', function (done) {
			config.memory = 128 - 64;
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('the memory value provided must be greater than or equal to 128');
			}).then(done, done.fail);
		});
		it('fails if memory value is 0', function (done) {
			config.memory = 0;
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('the memory value provided must be greater than or equal to 128');
			}).then(done, done.fail);
		});
		it('fails if memory value is > 1536', function (done) {
			config.memory = 1536 + 64;
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('the memory value provided must be less than or equal to 1536');
			}).then(done, done.fail);
		});
		it('fails if memory value is not a multiple of 64', function (done) {
			config.memory = 128 + 2;
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('the memory value provided must be a multiple of 64');
			}).then(done, done.fail);
		});
		it('creates memory size of 128 MB by default', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.MemorySize).toEqual(128);
			}).then(done, done.fail);
		});
		it('can specify memory size using the --memory argument', function (done) {
			config.memory = 1536;
			createFromDir('hello-world').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.MemorySize).toEqual(1536);
			}).then(done, done.fail);
		});
	});
	describe('timeout option support', function () {
		it('fails if timeout value is < 1', function (done) {
			config.timeout = 0;
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('the timeout value provided must be greater than or equal to 1');
			}).then(done, done.fail);
		});
		it('fails if timeout value is > 300', function (done) {
			config.timeout = 301;
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('the timeout value provided must be less than or equal to 300');
			}).then(done, done.fail);
		});
		it('creates timeout of 3 seconds by default', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.Timeout).toEqual(3);
			}).then(done, done.fail);
		});
		it('can specify timeout using the --timeout argument', function (done) {
			config.timeout = 300;
			createFromDir('hello-world').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.Timeout).toEqual(300);
			}).then(done, done.fail);
		});
	});
	describe('creating the function', function () {
		it('returns an object containing the new claudia configuration', function (done) {
			createFromDir('hello-world').then(function (creationResult) {
				expect(creationResult.lambda).toEqual({
					role: testRunName + '-executor',
					region: awsRegion,
					name: testRunName
				});
			}).then(done, done.fail);
		});
		it('uses the name from package.json if --name is not specified', function (done) {
			config.name = undefined;
			createFromDir('hello-world').then(function (creationResult) {
				expect(creationResult.lambda).toEqual({
					role: 'hello-world-executor',
					region: awsRegion,
					name: 'hello-world'
				});
			}).then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: 'hello-world'});
			}).then(function (lambdaResult) {
				expect(lambdaResult.Runtime).toEqual('nodejs4.3');
			}).then(done, done.fail);
		});
		it('uses the package.json description field if --description is not provided', function (done) {
			createFromDir('package-description').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.Description).toEqual('This is the package description');
			}).then(done, done.fail);
		});
		it('uses --description as the lambda description even if the package.json description field is provided', function (done) {
			config.description = 'description from config';
			createFromDir('package-description').then(function () {
				return lambda.getFunctionConfigurationPromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.Description).toEqual('description from config');
			}).then(done, done.fail);
		});
		it('saves the configuration into claudia.json', function (done) {
			createFromDir('hello-world').then(function (creationResult) {
				expect(JSON.parse(fs.readFileSync(path.join(workingdir, 'claudia.json'), 'utf8'))).toEqual(creationResult);
			}).then(done, done.fail);
		});
		it('saves the configuration into an alternative configuration file if provided', function (done) {
			config.config = path.join(workingdir, 'lambda.json');
			createFromDir('hello-world').then(function (creationResult) {
				expect(shell.test('-e', path.join(workingdir, 'claudia.json'))).toBeFalsy();
				expect(JSON.parse(fs.readFileSync(path.join(workingdir, 'lambda.json'), 'utf8'))).toEqual(creationResult);
			}).then(done, done.fail);
		});
		it('configures the function in AWS so it can be invoked', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello world"');
			}).then(done, done.fail);
		});
		it('configures the function so it will be versioned', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.listVersionsByFunctionPromise({FunctionName: testRunName});
			}).then(function (result) {
				expect(result.Versions.length).toEqual(2);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
			}).then(done, done.fail);
		});
		it('adds the latest alias', function (done) {
			config.version = 'great';
			createFromDir('hello-world').then(function () {
				return lambda.getAliasPromise({FunctionName: testRunName, Name: 'latest'});
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('$LATEST');
			}).then(done, done.fail);
		});
		it('adds the version alias if supplied', function (done) {
			config.version = 'great';
			createFromDir('hello-world').then(function () {
				return lambda.getAliasPromise({FunctionName: testRunName, Name: 'great'});
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('1');
			}).then(done, done.fail);
		});
		it('uses local dependencies if requested', function (done) {
			var projectDir =  path.join(__dirname, 'test-projects', 'local-dependencies');
			config['use-local-dependencies'] = true;
			shell.rm('-rf', path.join(projectDir, 'node_modules'));
			shell.mkdir(path.join(projectDir, 'node_modules'));
			shell.cp('-r', path.join(projectDir, 'local_modules', '*'),  path.join(projectDir, 'node_modules'));
			createFromDir('local-dependencies').then(function () {
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello local"');
			}).then(done, done.fail);
		});
		it('rewires relative local dependencies to reference original location after copy', function (done) {
			shell.cp('-r', path.join(__dirname, 'test-projects',  'relative-dependencies/*'), workingdir);
			config.source = path.join(workingdir, 'lambda');
			underTest(config).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
				return result;
			}).then(function () {
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello relative"');
			}).then(done, done.fail);
		});
		it('removes optional dependencies after validation if requested', function (done) {
			config['no-optional-dependencies'] = true;
			createFromDir('optional-dependencies').then(function () {
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"endpoint":"https://s3.amazonaws.com/","modules":[".bin","huh"]}');
			}).then(done, done.fail);
		});
		it('keeps the archive on the disk if --keep is specified', function (done) {
			config.keep = true;
			createFromDir('hello-world').then(function (result) {
				expect(result.archive).toBeTruthy();
				expect(shell.test('-e', result.archive));
			}).then(done, done.fail);
		});
		it('uses a s3 bucket if provided', function (done) {
			var s3 = Promise.promisifyAll(new aws.S3()),
				logger = new ArrayLogger(),
				bucketName = testRunName + '-bucket',
				archivePath;
			config.keep = true;
			config['use-s3-bucket'] = bucketName;
			s3.createBucketAsync({
				Bucket: bucketName
			}).then(function () {
				newObjects.s3bucket = bucketName;
			}).then(function () {
				return createFromDir('hello-world', logger);
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
				return lambda.invokePromise({FunctionName: testRunName});
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello world"');
			}).then(done, done.fail);
		});
	});
	describe('deploying a proxy api', function () {
		var apiGateway = retriableWrap(Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), function () {}, /Async$/);
		beforeEach(function () {
			config['deploy-proxy-api'] = true;
		});
		it('creates a proxy web API', function (done) {
			createFromDir('apigw-proxy-echo').then(function (creationResult) {
				var apiId = creationResult.api && creationResult.api.id;
				expect(apiId).toBeTruthy();
				expect(creationResult.api.url).toEqual('https://' + apiId + '.execute-api.us-east-1.amazonaws.com/latest');
				return apiId;
			}).then(function (apiId) {
				return apiGateway.getRestApiAsync({restApiId: apiId});
			}).then(function (restApi) {
				expect(restApi.name).toEqual(testRunName);
			}).then(done, done.fail);
		});
		it('saves the api ID without module into claudia.json', function (done) {
			createFromDir('apigw-proxy-echo').then(function (creationResult) {
				var savedContents = JSON.parse(fs.readFileSync(path.join(workingdir, 'claudia.json'), 'utf8'));
				expect(savedContents.api).toEqual({id: creationResult.api.id});
			}).then(done, done.fail);
		});
		it('sets up the API to route sub-resource calls to Lambda', function (done) {
			createFromDir('apigw-proxy-echo').then(function (creationResult) {
				return creationResult.api.id;
			}).then(function (apiId) {
				return callApi(apiId, awsRegion, 'latest/hello/there?abc=xkcd&dd=yy');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({abc: 'xkcd', dd: 'yy'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.path).toEqual('/hello/there');
				expect(params.requestContext.stage).toEqual('latest');
			}).then(done, done.fail);
		});
		it('sets up the API to route root calls to Lambda', function (done) {
			createFromDir('apigw-proxy-echo').then(function (creationResult) {
				return creationResult.api.id;
			}).then(function (apiId) {
				return callApi(apiId, awsRegion, 'latest?abc=xkcd&dd=yy');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({abc: 'xkcd', dd: 'yy'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.path).toEqual('/');
				expect(params.requestContext.stage).toEqual('latest');
			}).then(done, done.fail);
		});

		it('sets up a versioned API with the stage name corresponding to the lambda alias', function (done) {
			config.version = 'development';
			createFromDir('apigw-proxy-echo').then(function (creationResult) {
				return creationResult.api.id;
			}).then(function (apiId) {
				return callApi(apiId, awsRegion, 'development/hello/there?abc=xkcd&dd=yy');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.queryStringParameters).toEqual({abc: 'xkcd', dd: 'yy'});
				expect(params.requestContext.httpMethod).toEqual('GET');
				expect(params.path).toEqual('/hello/there');
				expect(params.requestContext.stage).toEqual('development');
			}).then(done, done.fail);
		});
	});
	describe('creating the web api', function () {
		var apiGateway = retriableWrap(Promise.promisifyAll(new aws.APIGateway({region: awsRegion})), function () {}, /Async$/),
			apiId;
		beforeEach(function () {
			config.handler = undefined;
			config['api-module'] = 'main';
		});
		it('ignores the handler but creates an API if the api-module is provided', function (done) {
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				var apiId = creationResult.api && creationResult.api.id;
				expect(apiId).toBeTruthy();
				expect(creationResult.api.module).toEqual('main');
				expect(creationResult.api.url).toEqual('https://' + apiId + '.execute-api.us-east-1.amazonaws.com/latest');
				return apiId;
			}).then(function (apiId) {
				return apiGateway.getRestApiAsync({restApiId: apiId});
			}).then(function (restApi) {
				expect(restApi.name).toEqual(testRunName);
			}).then(done, done.fail);
		});
		it('saves the api name and module only into claudia.json', function (done) {
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				var savedContents = JSON.parse(fs.readFileSync(path.join(workingdir, 'claudia.json'), 'utf8'));
				expect(savedContents.api).toEqual({id: creationResult.api.id, module: creationResult.api.module});
			}).then(done, done.fail);
		});
		it('works when the source is a relative path', function (done) {
			var workingParent = path.dirname(workingdir),
				relativeWorkingDir = './' + path.basename(workingdir);
			shell.cd(workingParent);
			config.source = relativeWorkingDir;
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				var savedContents = JSON.parse(fs.readFileSync(path.join(workingdir, 'claudia.json'), 'utf8'));
				expect(savedContents.api).toEqual({id: creationResult.api.id, module: creationResult.api.module});
			}).then(done, done.fail);
		});
		it('uses the name from package.json if --name is not provided', function (done) {
			config.name = undefined;
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				var apiId = creationResult.api && creationResult.api.id;
				newObjects.restApi = apiId;
				return apiId;
			}).then(function (apiId) {
				return apiGateway.getRestApiAsync({restApiId: apiId});
			}).then(function (restApi) {
				expect(restApi.name).toEqual('api-gw-hello-world');
			}).then(done, done.fail);
		});

		it('when no version provided, creates the latest deployment', function (done) {
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				apiId = creationResult.api && creationResult.api.id;
			}).then(function () {
				return callApi(apiId, awsRegion, 'latest/hello');
			}).then(function (contents) {
				expect(contents.body).toEqual('"hello world"');
			}).then(done, done.fail);
		});
		it('when the version is provided, creates the deployment with that name', function (done) {
			config.version = 'development';
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				apiId = creationResult.api && creationResult.api.id;
				expect(creationResult.api.url).toEqual('https://' + apiId + '.execute-api.us-east-1.amazonaws.com/development');
			}).then(function () {
				return callApi(apiId, awsRegion, 'development/hello');
			}).then(function (contents) {
				expect(contents.body).toEqual('"hello world"');
			}).then(done, done.fail);
		});

		it('adds an api config cache if requested', function (done) {
			config['cache-api-config'] = 'claudiaConfig';
			createFromDir('api-gw-echo').then(function (creationResult) {
				apiId = creationResult.api && creationResult.api.id;
			}).then(function () {
				return callApi(apiId, awsRegion, 'latest/echo');
			}).then(function (contents) {
				var params = JSON.parse(contents.body);
				expect(params.stageVariables).toEqual({
					lambdaVersion: 'latest',
					claudiaConfig: 'nWvdJ3sEScZVJeZSDq4LZtDsCZw9dDdmsJbkhnuoZIY='
				});
			}).then(done, done.fail);
		});

		it('makes it possible to deploy a custom stage, as long as the lambdaVersion is defined', function (done) {
			config.version = 'development';
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				apiId = creationResult.api && creationResult.api.id;
				return apiGateway.createDeploymentAsync({
					restApiId: apiId,
					stageName: 'fromtest',
					variables: {
						lambdaVersion: 'development'
					}
				});
			}).then(function () {
				return callApi(apiId, awsRegion, 'fromtest/hello', {retry: 403});
			}).then(function (contents) {
				expect(contents.body).toEqual('"hello world"');
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail();
			});
		});
		it('executes post-deploy if provided with the api', function (done) {
			config.version = 'development';
			config.postcheck = 'option-123';
			config.postresult = 'option-result-post';
			createFromDir('api-gw-postdeploy').then(function (creationResult) {
				apiId = creationResult.api && creationResult.api.id;
				expect(creationResult.api.deploy).toEqual('option-result-post');
			}).then(function () {
				return callApi(apiId, awsRegion, 'postdeploy/hello', {retry: 403});
			}).then(function (contents) {
				expect(JSON.parse(contents.body)).toEqual({
					'postinstallfname': testRunName,
					'postinstallalias': 'development',
					'postinstallapiid': apiId,
					'postinstallregion': awsRegion,
					'hasPromise': 'true',
					'postinstallapiUrl': 'https://' + apiId + '.execute-api.us-east-1.amazonaws.com/development',
					'hasAWS': 'true',
					'postinstalloption': 'option-123',
					'lambdaVersion': 'development'
				});
			}).then(done, function (e) {
				console.log(JSON.stringify(e));
				done.fail();
			});
		});
		it('works with non-reentrant modules', function (done) {
			global.MARKED = false;
			createFromDir('non-reentrant').then(done, done.fail);
		});
	});
	it('logs call execution', function (done) {
		var logger = new ArrayLogger();
		config.handler = undefined;
		config['api-module'] = 'main';
		createFromDir('api-gw-hello-world', logger).then(function () {
			expect(logger.getStageLog(true).filter(function (entry) {
				return entry !== 'waiting for IAM role propagation' && entry !== 'rate-limited by AWS, waiting before retry';
			})).toEqual([
				'loading package config',
				'packaging files',
				'validating package',
				'zipping package',
				'initialising IAM role',
				'creating Lambda',
				'creating version alias',
				'creating REST API',
				'saving configuration'
			]);
			expect(logger.getApiCallLogForService('lambda', true)).toEqual([
				'lambda.createFunction', 'lambda.updateAlias', 'lambda.createAlias'
			]);
			expect(logger.getApiCallLogForService('iam', true)).toEqual(['iam.createRole']);
			expect(logger.getApiCallLogForService('sts', true)).toEqual(['sts.getCallerIdentity']);
			expect(logger.getApiCallLogForService('apigateway', true)).toEqual([
				'apigateway.createRestApi',
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
});
