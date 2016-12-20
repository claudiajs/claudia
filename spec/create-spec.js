/*global describe, require, it, expect, beforeAll, beforeEach, afterAll, afterEach, console, jasmine, __dirname, global */
var underTest = require('../src/commands/create'),
	tmppath = require('../src/util/tmppath'),
	callApi = require('../src/util/call-api'),
	templateFile = require('../src/util/template-file'),
	ArrayLogger = require('../src/util/array-logger'),
	shell = require('shelljs'),
	fs = require('../src/util/fs-promise'),
	retriableWrap = require('../src/util/retriable-wrap'),
	path = require('path'),
	os = require('os'),
	aws = require('aws-sdk'),
	awsRegion = require('./helpers/test-aws-region');
describe('create', function () {
	'use strict';
	var workingdir, testRunName, iam, lambda, newObjects, config,logs,
		apiGatewayPromise,
		createFromDir = function (dir, logger) {
			if (!shell.test('-e', workingdir)) {
				shell.mkdir('-p', workingdir);
			}
			shell.cp('-r',
				path.join(__dirname, 'test-projects/', (dir || 'hello-world')) + '/*',
				workingdir);
			if (shell.test('-e', path.join(__dirname, 'test-projects/', (dir || 'hello-world'), '.npmrc'))) {
				shell.cp(
					path.join(__dirname, 'test-projects/', (dir || 'hello-world'), '.npmrc'),
					workingdir
				);
			}
			return underTest(config, logger).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = (result.api && result.api.id) || (result.proxyApi && result.proxyApi.id);
				return result;
			});
		},
		getLambdaConfiguration = function () {
			return lambda.getFunctionConfiguration({FunctionName: testRunName}).promise();
		};
	beforeEach(function () {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		iam = new aws.IAM();
		lambda = new aws.Lambda({region: awsRegion});
		apiGatewayPromise = retriableWrap(new aws.APIGateway({region: awsRegion}));
		logs = new aws.CloudWatchLogs({region: awsRegion});
		newObjects = {workingdir: workingdir};
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
		config = {name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'};
	});
	afterEach(function (done) {
		this.destroyObjects(newObjects).then(done);
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
		it('fails if the handler does not contain a dot', function (done) {
			config.handler = 'api';
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('Lambda handler function not specified. Please specify with --handler module.function');
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
		it('fails if subnetIds is specified without securityGroupIds', function (done) {
			config['subnet-ids'] = 'subnet-abcdef12';
			config['security-group-ids'] = null;
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('VPC access requires at lease one security group id *and* one subnet id');
			}).then(done);
		});
		it('fails if securityGroupIds is specified without subnetIds', function (done) {
			config['subnet-ids'] = null;
			config['security-group-ids'] = 'sg-12341234';
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('VPC access requires at lease one security group id *and* one subnet id');
			}).then(done);
		});
		it('fails if the api module contains an extension', function (done) {
			config.handler = undefined;
			config['api-module'] = 'api.js';
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('API module must be a module name, without the file extension or function name');
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
			config['optional-dependencies'] = false;
			createFromDir('hello-world').then(done.fail, function (message) {
				expect(message).toEqual('incompatible arguments --use-local-dependencies and --no-optional-dependencies');
				done();
			});
		});
		it('validates the package before creating the role or the function', function (done) {
			createFromDir('echo-dependency-problem').then(function () {
				done.fail('create succeeded');
			}, function (reason) {
				expect(reason).toEqual('cannot require ./main after clean installation. Check your dependencies.');
			}).then(function () {
				return iam.getRole({RoleName: testRunName + '-executor'}).promise().then(function () {
					done.fail('iam role was created');
				}, function () {});
			}).then(getLambdaConfiguration)
			.then(function () {
				done.fail('function was created');
			}, done);
		});
	});
	describe('role management', function () {


		it('creates the IAM role for the lambda', function (done) {
			createFromDir('hello-world').then(function () {
				return iam.getRole({RoleName: testRunName + '-executor'}).promise();
			}).then(function (role) {
				expect(role.Role.RoleName).toEqual(testRunName + '-executor');
			}).then(done, done.fail);
		});
		describe('when a role is provided', function () {
			var createdRole, roleName, logger,
				invoke = function () {
					return lambda.invoke({
						FunctionName: testRunName,
						InvocationType: 'RequestResponse'
					}).promise();
				};
			beforeEach(function (done) {
				roleName = testRunName + '-manual';
				logger = new ArrayLogger();
				fs.readFileAsync(templateFile('lambda-exector-policy.json'), 'utf8')
				.then(function (lambdaRolePolicy) {
					return iam.createRole({
						RoleName: roleName,
						AssumeRolePolicyDocument: lambdaRolePolicy
					}).promise();
				}).then(function (result) {
					createdRole = result.Role;
				}).then(done, done.fail);
			});
			it('creates the function using the provided role by name', function (done) {
				config.role = testRunName + '-manual';
				createFromDir('hello-world', logger).then(function (createResult) {
					expect(createResult.lambda.role).toEqual(testRunName + '-manual');
				}).then(getLambdaConfiguration)
				.then(function (lambdaMetadata) {
					expect(lambdaMetadata.Role).toEqual(createdRole.Arn);
				}).then(invoke)
				.then(function (result) {
					expect(JSON.parse(result.Payload)).toEqual('hello world');
				}).then(function () {
					return iam.getRole({RoleName: testRunName + '-executor'}).promise();
				}).then(function () {
					done.fail('Executor role was created');
				}, done);
			});
			it('does not set up any additional cloudwatch policies if --role is provided', function (done) {
				config.role = testRunName + '-manual';
				createFromDir('hello-world', logger).then(function () {
					return iam.listRolePolicies({RoleName: roleName}).promise();
				}).then(function (result) {
					expect(result.PolicyNames).toEqual([]);
				}).then(done, done.fail);
			});
			it('creates the function using the provided role by ARN, without any IAM calls', function (done) {
				config.role = createdRole.Arn;
				createFromDir('hello-world', logger).then(function () {
					newObjects.lambdaRole = false;
					expect(logger.getApiCallLogForService('iam', true)).toEqual([]);
				}).then(getLambdaConfiguration)
				.then(function (lambdaMetadata) {
					expect(lambdaMetadata.Role).toEqual(createdRole.Arn);
				}).then(invoke)
				.then(function (result) {
					expect(JSON.parse(result.Payload)).toEqual('hello world');
				}).then(function () {
					return iam.listRolePolicies({RoleName: roleName}).promise();
				}).then(function (result) {
					expect(result.PolicyNames).toEqual([]);
				}).then(done, done.fail);
			});
		});
		it('allows the function to log to cloudwatch', function (done) {
			logs.createLogGroup({logGroupName: testRunName + '-group'}).promise().then(function () {
				newObjects.logGroup = testRunName + '-group';
				return logs.createLogStream({logGroupName: testRunName + '-group', logStreamName: testRunName + '-stream'}).promise();
			}).then(function () {
				return createFromDir('cloudwatch-log');
			}).then(function () {
				return lambda.invoke({
					FunctionName: testRunName,
					Payload: JSON.stringify({
						region: awsRegion,
						stream: testRunName + '-stream',
						group: testRunName + '-group',
						message: 'hello ' + testRunName
					})
				}).promise();
			}).then(function () {
				return logs.getLogEvents({logGroupName: testRunName + '-group', logStreamName: testRunName + '-stream'}).promise();
			}).then(function (logEvents) {
				expect(logEvents.events.length).toEqual(1);
				expect(logEvents.events[0].message).toEqual('hello ' + testRunName);
			}).then(done, done.fail);
		});
		it('allows function to call itself if --allow-recursion is specified', function (done) {
			config['allow-recursion'] = true;
			createFromDir('hello-world').then(function () {
				return iam.listRolePolicies({RoleName: testRunName + '-executor'}).promise();
			}).then(function (result) {
				expect(result.PolicyNames).toEqual(['log-writer', 'recursive-execution']);
			}).then(function () {
				return iam.getRolePolicy({PolicyName: 'recursive-execution', RoleName:  testRunName + '-executor'}).promise();
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
								'Resource': 'arn:aws:lambda:' + awsRegion + ':*:function:' + testRunName
							}]
						});
			}).then(done, function (e) {
				console.log(e);
				done.fail();
			});
		});
		describe('when VPC access is desired', function () {
			var vpc, subnet, securityGroup,
					securityGroupName = testRunName + 'SecurityGroup',
					CidrBlock = '10.0.0.0/16',
					ec2 = new aws.EC2({region: awsRegion});
			beforeAll(function (done) {
				ec2.createVpc({CidrBlock: CidrBlock}).promise().then(function (vpcData) {
					vpc = vpcData.Vpc;
					return ec2.createSubnet({CidrBlock: CidrBlock, VpcId: vpc.VpcId}).promise();
				}).then(function (subnetData) {
					subnet = subnetData.Subnet;
					return ec2.createSecurityGroup({GroupName: securityGroupName, Description: 'Temporary testing group', VpcId: vpc.VpcId}).promise();
				}).then(function (securityGroupData) {
					securityGroup = securityGroupData;
				}).then(done, done.fail);
			});
			afterAll(function (done) {
				ec2.deleteSubnet({SubnetId: subnet.SubnetId}).promise().then(function () {
					return ec2.deleteSecurityGroup({GroupId: securityGroup.GroupId}).promise();
				}).then(function () {
					return ec2.deleteVpc({VpcId: vpc.VpcId}).promise();
				}).then(function () {
					done();
				}).catch(done.fail);
			});
			it('adds subnet and security group membership to the function', function (done) {
				config['security-group-ids'] = securityGroup.GroupId;
				config['subnet-ids'] = subnet.SubnetId;
				createFromDir('hello-world').then(function () {
					return getLambdaConfiguration();
				}).then(function (result) {
					expect(result.VpcConfig.SecurityGroupIds[0]).toEqual(securityGroup.GroupId);
					expect(result.VpcConfig.SubnetIds[0]).toEqual(subnet.SubnetId);
				}).then(done, function (e) {
					console.log(e);
					done.fail();
				});
			});
			it('adds VPC Access IAM role', function (done) {
				config['security-group-ids'] = securityGroup.GroupId;
				config['subnet-ids'] = subnet.SubnetId;
				createFromDir('hello-world').then(function () {
					return iam.listRolePolicies({RoleName: testRunName + '-executor'}).promise();
				}).then(function (result) {
					expect(result.PolicyNames).toEqual(['log-writer', 'vpc-access-execution']);
				}).then(function () {
					return iam.getRolePolicy({PolicyName: 'vpc-access-execution', RoleName:  testRunName + '-executor'}).promise();
				}).then(function (policy) {
					expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(
						{
							'Version': '2012-10-17',
							'Statement': [{
								'Sid': 'VPCAccessExecutionPermission',
								'Effect': 'Allow',
								'Action': [
									'logs:CreateLogGroup',
									'logs:CreateLogStream',
									'logs:PutLogEvents',
									'ec2:CreateNetworkInterface',
									'ec2:DeleteNetworkInterface',
									'ec2:DescribeNetworkInterfaces'
								],
								'Resource': '*'
							}]
						});
				}).then(done, function (e) {
					console.log(e);
					done.fail();
				});
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
				return iam.listRolePolicies({RoleName: testRunName + '-executor'}).promise();
			}).then(function (result) {
				expect(result.PolicyNames).toEqual(['log-writer', 'ses-policy-json']);
			}).then(function () {
				return iam.getRolePolicy({PolicyName: 'ses-policy-json', RoleName:  testRunName + '-executor'}).promise();
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
				return iam.listRolePolicies({RoleName: testRunName + '-executor'}).promise();
			}).then(function (result) {
				expect(result.PolicyNames).toEqual(['log-writer', 'ses-policy-json']);
			}).then(function () {
				return iam.getRolePolicy({PolicyName: 'ses-policy-json', RoleName:  testRunName + '-executor'}).promise();
			}).then(function (policy) {
				expect(JSON.parse(decodeURIComponent(policy.PolicyDocument))).toEqual(sesPolicy);
			}).then(done, done.fail);
		});
		it('fails if the policies argument does not match any files', function (done) {
			config.policies = path.join('*.NOT');
			createFromDir('hello-world').then(done.fail, function (error) {
				expect(error).toEqual('no files match additional policies (*.NOT)');
			}).then(function () {
				return iam.getRole({RoleName: testRunName + '-executor'}).promise().then(function () {
					done.fail('iam role was created');
				}, function () {});
			}).then(getLambdaConfiguration)
			.then(function () {
				done.fail('function was created');
			}, done);
		});
	});
	describe('runtime support', function () {
		it('creates node 4.3 deployments by default', function (done) {
			createFromDir('hello-world')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
				expect(lambdaResult.Runtime).toEqual('nodejs4.3');
			}).then(done, done.fail);
		});
		it('can create legacy 0.10 deployments using the --runtime argument', function (done) {
			config.runtime = 'nodejs';
			createFromDir('hello-world')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
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
			createFromDir('hello-world')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
				expect(lambdaResult.MemorySize).toEqual(128);
			}).then(done, done.fail);
		});
		it('can specify memory size using the --memory argument', function (done) {
			config.memory = 1536;
			createFromDir('hello-world')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
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
			createFromDir('hello-world')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
				expect(lambdaResult.Timeout).toEqual(3);
			}).then(done, done.fail);
		});
		it('can specify timeout using the --timeout argument', function (done) {
			config.timeout = 300;
			createFromDir('hello-world')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
				expect(lambdaResult.Timeout).toEqual(300);
			}).then(done, done.fail);
		});
	});
	describe('creating the function', function () {
		it('wires up the handler so the function is executable', function (done) {
			createFromDir('echo').then(function () {
				return lambda.invoke({
					FunctionName: testRunName,
					InvocationType: 'RequestResponse',
					Payload: JSON.stringify({
						message: 'hello ' + testRunName
					})
				}).promise();
			}).then(function (result) {
				expect(JSON.parse(result.Payload)).toEqual({message: 'hello ' + testRunName});
			}).then(done, done.fail);
		});
		it('wires up handlers from subfolders', function (done) {
			shell.mkdir('-p', path.join(workingdir, 'subdir'));
			shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
			shell.mv(path.join(workingdir, 'main.js'), path.join(workingdir, 'subdir', 'mainfromsub.js'));
			config.handler = 'subdir/mainfromsub.handler';
			shell.cd(workingdir);
			underTest(config).then(function () {
				return lambda.invoke({
					FunctionName: testRunName,
					InvocationType: 'RequestResponse',
					Payload: JSON.stringify({
						message: 'hello ' + testRunName
					})
				}).promise();
			}).then(function (result) {
				expect(JSON.parse(result.Payload)).toEqual({message: 'hello ' + testRunName});
			}).then(done, done.fail);
		});

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
				return lambda.getFunctionConfiguration({FunctionName: 'hello-world'}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.Runtime).toEqual('nodejs4.3');
			}).then(done, done.fail);
		});
		it('renames scoped NPM packages to a sanitized Lambda name', function (done) {
			config.name = undefined;
			createFromDir('hello-world-scoped').then(function (creationResult) {
				expect(creationResult.lambda).toEqual({
					role: 'test_hello-world-executor',
					region: awsRegion,
					name: 'test_hello-world'
				});
			}).then(function () {
				return lambda.getFunctionConfiguration({FunctionName: 'test_hello-world'}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.Runtime).toEqual('nodejs4.3');
			}).then(done, done.fail);
		});
		it('uses the package.json description field if --description is not provided', function (done) {
			createFromDir('package-description')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
				expect(lambdaResult.Description).toEqual('This is the package description');
			}).then(done, done.fail);
		});
		it('uses --description as the lambda description even if the package.json description field is provided', function (done) {
			config.description = 'description from config';
			createFromDir('package-description')
			.then(getLambdaConfiguration)
			.then(function (lambdaResult) {
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
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello world"');
			}).then(done, done.fail);
		});
		it('configures the function so it will be versioned', function (done) {
			createFromDir('hello-world').then(function () {
				return lambda.listVersionsByFunction({FunctionName: testRunName}).promise();
			}).then(function (result) {
				expect(result.Versions.length).toEqual(2);
				expect(result.Versions[0].Version).toEqual('$LATEST');
				expect(result.Versions[1].Version).toEqual('1');
			}).then(done, done.fail);
		});
		it('adds the latest alias', function (done) {
			config.version = 'great';
			createFromDir('hello-world').then(function () {
				return lambda.getAlias({FunctionName: testRunName, Name: 'latest'}).promise();
			}).then(function (result) {
				expect(result.FunctionVersion).toEqual('$LATEST');
			}).then(done, done.fail);
		});
		it('adds the version alias if supplied', function (done) {
			config.version = 'great';
			createFromDir('hello-world').then(function () {
				return lambda.getAlias({FunctionName: testRunName, Name: 'great'}).promise();
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
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello local"');
			}).then(done, done.fail);
		});
		it('rewires relative local dependencies to reference original location after copy', function (done) {
			shell.mkdir('-p', workingdir);
			shell.cp('-r', path.join(__dirname, 'test-projects',  'relative-dependencies/*'), workingdir);
			config.source = path.join(workingdir, 'lambda');
			underTest(config).then(function (result) {
				newObjects.lambdaRole = result.lambda && result.lambda.role;
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
				newObjects.restApi = result.api && result.api.id;
				return result;
			}).then(function () {
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello relative"');
			}).then(done, done.fail);
		});
		it('removes optional dependencies after validation if requested', function (done) {
			config['optional-dependencies'] = false;
			createFromDir('optional-dependencies').then(function () {
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"endpoint":"https://s3.amazonaws.com/","modules":[".bin","huh"]}');
			}).then(done, done.fail);
		});
		it('removes .npmrc from the package', function (done) {
			createFromDir('ls-dir').then(function () {
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('{"files":["main.js","node_modules","package.json"]}');
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
			var s3 = new aws.S3(),
				logger = new ArrayLogger(),
				bucketName = testRunName + '-bucket',
				archivePath;
			config.keep = true;
			config['use-s3-bucket'] = bucketName;
			s3.createBucket({
				Bucket: bucketName
			}).promise().then(function () {
				newObjects.s3bucket = bucketName;
			}).then(function () {
				return createFromDir('hello-world', logger);
			}).then(function (result) {
				var expectedKey = path.basename(result.archive);
				archivePath = result.archive;
				expect(result.s3key).toEqual(expectedKey);
				return s3.headObject({
					Bucket: bucketName,
					Key: expectedKey
				}).promise();
			}).then(function (fileResult) {
				expect(parseInt(fileResult.ContentLength)).toEqual(fs.statSync(archivePath).size);
			}).then(function () {
				expect(logger.getApiCallLogForService('s3', true)).toEqual(['s3.upload']);
			}).then(function () {
				return lambda.invoke({FunctionName: testRunName}).promise();
			}).then(function (lambdaResult) {
				expect(lambdaResult.StatusCode).toEqual(200);
				expect(lambdaResult.Payload).toEqual('"hello world"');
			}).then(done, done.fail);
		});
	});
	describe('deploying a proxy api', function () {
		beforeEach(function () {
			config['deploy-proxy-api'] = true;
		});
		it('creates a proxy web API', function (done) {
			createFromDir('apigw-proxy-echo').then(function (creationResult) {
				var apiId = creationResult.api && creationResult.api.id;
				expect(apiId).toBeTruthy();
				expect(creationResult.api.url).toEqual('https://' + apiId + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
				return apiId;
			}).then(function (apiId) {
				return apiGatewayPromise.getRestApiPromise({restApiId: apiId});
			}).then(function (restApi) {
				expect(restApi.name).toEqual(testRunName);
			}).then(done, done.fail);
		});
		it('creates a proxy web API using a handler from a subfolder', function (done) {
			shell.mkdir('-p', path.join(workingdir, 'subdir'));
			shell.cp('-r', 'spec/test-projects/apigw-proxy-echo/*', workingdir);
			shell.mv(path.join(workingdir, 'main.js'), path.join(workingdir, 'subdir', 'mainfromsub.js'));
			config.handler = 'subdir/mainfromsub.handler';
			shell.cd(workingdir);
			underTest(config).then(function (creationResult) {
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
		var apiId;
		beforeEach(function () {
			config.handler = undefined;
			config['api-module'] = 'main';
		});
		it('ignores the handler but creates an API if the api-module is provided', function (done) {
			createFromDir('api-gw-hello-world').then(function (creationResult) {
				var apiId = creationResult.api && creationResult.api.id;
				expect(apiId).toBeTruthy();
				expect(creationResult.api.module).toEqual('main');
				expect(creationResult.api.url).toEqual('https://' + apiId + '.execute-api.' + awsRegion + '.amazonaws.com/latest');
				return apiId;
			}).then(function (apiId) {
				return apiGatewayPromise.getRestApiPromise({restApiId: apiId});
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
				return apiGatewayPromise.getRestApiPromise({restApiId: apiId});
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
		it('wires up the api module from a subfolder', function (done) {
			shell.mkdir('-p', path.join(workingdir, 'subdir'));
			shell.cp('-r', 'spec/test-projects/api-gw-hello-world/*', workingdir);
			shell.mv(path.join(workingdir, 'main.js'), path.join(workingdir, 'subdir', 'mainfromsub.js'));
			config['api-module'] = 'subdir/mainfromsub';
			shell.cd(workingdir);

			underTest(config).then(function (creationResult) {
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
				expect(creationResult.api.url).toEqual('https://' + apiId + '.execute-api.' + awsRegion + '.amazonaws.com/development');
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
				return apiGatewayPromise.createDeploymentPromise({
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
				expect(creationResult.api.deploy).toEqual({
					result: 'option-result-post',
					wasApiCacheUsed: false
				});
			}).then(function () {
				return callApi(apiId, awsRegion, 'postdeploy/hello', {retry: 403});
			}).then(function (contents) {
				expect(JSON.parse(contents.body)).toEqual({
					'postinstallfname': testRunName,
					'postinstallalias': 'development',
					'postinstallapiid': apiId,
					'postinstallregion': awsRegion,
					'hasPromise': 'true',
					'postinstallapiUrl': 'https://' + apiId + '.execute-api.' + awsRegion + '.amazonaws.com/development',
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
				'apigateway.setupRequestListeners',
				'apigateway.setAcceptHeader',
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
	describe('environment variables', function () {
		var standardEnvKeys,
			logger,
			nonStandard = function (key) {
				return standardEnvKeys.indexOf(key) < 0;
			};
		beforeEach(function () {
			logger = new ArrayLogger();
			standardEnvKeys = [
				'PATH', 'LANG', 'LD_LIBRARY_PATH', 'LAMBDA_TASK_ROOT', 'LAMBDA_RUNTIME_DIR', 'AWS_REGION',
				'AWS_DEFAULT_REGION', 'AWS_LAMBDA_LOG_GROUP_NAME', 'AWS_LAMBDA_LOG_STREAM_NAME',
				'AWS_LAMBDA_FUNCTION_NAME', 'AWS_LAMBDA_FUNCTION_MEMORY_SIZE', 'AWS_LAMBDA_FUNCTION_VERSION',
				'NODE_PATH', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'
			].sort();
		});
		it('does not add any additional environment variables if set-env not provided', function (done) {
			createFromDir('env-vars').then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName
				}).promise();
			}).then(function (configuration) {
				expect(configuration.Environment).toBeUndefined();
			}).then(function () {
				return lambda.invoke({
					FunctionName: testRunName,
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(function (result) {
				expect(Object.keys(JSON.parse(result.Payload)).sort()).toEqual(standardEnvKeys);
			}).then(done, done.fail);
		});
		it('refuses to work when reading environment variables fails', function (done) {
			config['set-env'] = 'XPATH,YPATH=/var/lib';
			createFromDir('env-vars', logger).then(done.fail, function (message) {
				expect(message).toEqual('Cannot read variables from set-env, Invalid CSV element XPATH');
				expect(logger.getApiCallLogForService('lambda', true)).toEqual([]);
				expect(logger.getApiCallLogForService('iam', true)).toEqual([]);
				done();
			});
		});
		it('adds env variables specified in a key-value pair', function (done) {
			config['set-env'] = 'XPATH=/var/www,YPATH=/var/lib';
			createFromDir('env-vars').then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName
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
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(function (result) {
				var env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'YPATH']);
				expect(env.XPATH).toEqual('/var/www');
				expect(env.YPATH).toEqual('/var/lib');
			}).then(done, done.fail);
		});
		it('adds env variables specified in a JSON file', function (done) {
			var envpath = path.join(workingdir, 'env.json');
			shell.mkdir('-p', workingdir);
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/var/www', 'YPATH': '/var/lib'}), 'utf8');
			config['set-env-from-json'] = envpath;
			createFromDir('env-vars').then(function () {
				return lambda.getFunctionConfiguration({
					FunctionName: testRunName
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
					InvocationType: 'RequestResponse'
				}).promise();
			}).then(function (result) {
				var env = JSON.parse(result.Payload);
				expect(Object.keys(env).filter(nonStandard).sort()).toEqual(['XPATH', 'YPATH']);
				expect(env.XPATH).toEqual('/var/www');
				expect(env.YPATH).toEqual('/var/lib');
			}).then(done, done.fail);
		});
		it('tries to set the KMS key ARN', function (done) {
			// note, creating a KMS key costs $1 each time, so
			// this is just testing that the code tries to set
			// the key instead of actually using it
			config['set-env'] = 'XPATH=/var/www,YPATH=/var/lib';
			config['env-kms-key-arn'] = 'arn:a:b:c:d';
			createFromDir('env-vars').then(done.fail, function (err) {
				expect(err.code).toEqual('ValidationException');
				expect(err.message).toMatch(/Value 'arn:a:b:c:d' at 'kMSKeyArn' failed to satisfy constraint/);
			}).then(done, done.fail);
		});
	});
});
