/*global describe, it, expect, beforeEach, afterEach */
const underTest = require('../src/commands/set-cloudfront-trigger'),
	create = require('../src/commands/create'),
	findCloudfrontBehavior = require('../src/tasks/find-cloudfront-behavior'),
	destroyObjects = require('./util/destroy-objects'),
	tmppath = require('../src/util/tmppath'),
	fsUtil = require('../src/util/fs-util'),
	aws = require('aws-sdk'),
	fs = require('fs'),
	awsRegion = require('./util/test-aws-region'),
	distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
if (!distributionId) {
	return;
}
describe('setCloudfrontTrigger', () => {
	'use strict';
	let workingdir, testRunName, newObjects, config, cloudfront, iam;
	beforeEach(() => {
		workingdir = tmppath();
		cloudfront = new aws.CloudFront();
		iam = new aws.IAM({region: awsRegion});
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		fs.mkdirSync(workingdir);
		config = {
			quiet: true,
			version: 1,
			'event-types': 'viewer-request,origin-request',
			source: workingdir,
			'distribution-id': distributionId,
			'aws-delay': process.env.AWS_DEPLOY_TIMEOUT,
			'aws-retries': process.env.AWS_DEPLOY_RETRIES
		};
	});
	afterEach(done => {
		delete newObjects.lambdaFunction; //replicated functions cannot be deleted
		destroyObjects(newObjects).then(done, done.fail);
	});
	describe('param validation', () => {
		it('rejects if distribution-id is not set', done => {
			delete config['distribution-id'];
			underTest(config).then(done.fail)
				.catch(e => expect(e).toMatch(/Cloudfront Distribution ID is not specified/))
				.then(done, done.fail);
		});
		it('rejects if version is not set', done => {
			delete config.version;
			underTest(config).then(done.fail)
				.catch(e => expect(e).toMatch(/Lambda@Edge requires a fixed version/))
				.then(done, done.fail);
		});
		it('rejects if event types are not set', done => {
			delete config['event-types'];
			underTest(config).then(done.fail)
				.catch(e => expect(e).toMatch(/Event types must be specified/))
				.then(done, done.fail);
		});

	});
	describe('when params are valid', () => {
		let createConfig;
		const createLambda = function () {
				return create(createConfig)
				.then(result => {
					newObjects.lambdaRole = result.lambda && result.lambda.role;
					newObjects.lambdaFunction = result.lambda && result.lambda.name;
				});
			},
			extractLambdaAssociations = function (distributionConfig, behaviorPath) {
				const behavior = findCloudfrontBehavior(distributionConfig, behaviorPath),
					lambdaAssociationArray = behavior.LambdaFunctionAssociations.Items,
					associations = {};
				lambdaAssociationArray.forEach(item => associations[item.EventType] = item.LambdaFunctionARN);
				return associations;
			};
		beforeEach(() => {
			createConfig = { version: 'dev', name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler' };
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		});
		describe('when the version is an alias', () => {
			beforeEach(done => {
				config.version = 'dev';
				createLambda(createConfig)
					.then(() => underTest(config))
					.then(done, done.fail);
			});
			it('assigns the events for the actual numeric version', done => {
				cloudfront.getDistributionConfig({Id: distributionId}).promise()
					.then(result => extractLambdaAssociations(result.DistributionConfig))
					.then(associations => {
						expect(associations['viewer-request']).toMatch(new RegExp(`${testRunName}:1$`));
						expect(associations['origin-request']).toMatch(new RegExp(`${testRunName}:1$`));
					})
					.then(done, done.fail);
			});
		});
		describe('when the version is a number', () => {
			beforeEach(done => {
				config.version = 1;
				createLambda(createConfig)
					.then(() => underTest(config))
					.then(done, done.fail);
			});
			it('assigns the events for the given version', done => {
				cloudfront.getDistributionConfig({Id: distributionId}).promise()
					.then(result => extractLambdaAssociations(result.DistributionConfig))
					.then(associations => {
						expect(associations['viewer-request']).toMatch(new RegExp(`${testRunName}:1$`));
						expect(associations['origin-request']).toMatch(new RegExp(`${testRunName}:1$`));
					})
					.then(done, done.fail);
			});
		});
		describe('role assignment', () => {
			beforeEach(done => {
				config.version = 'dev';
				createLambda(createConfig)
					.then(() => underTest(config))
					.then(done, done.fail);
			});
			it('allows function to assume role lambda@edge', done => {
				iam.getRole({RoleName: newObjects.lambdaRole}).promise()
					.then(result => {
						const policyDocument = unescape((result.Role.AssumeRolePolicyDocument)),
							policy = JSON.parse(policyDocument);
						expect(policy.Statement.length).toEqual(2);
						expect(policy.Statement[1].Effect).toEqual('Allow');
						expect(policy.Statement[1].Action).toEqual('sts:AssumeRole');
						expect(policy.Statement[1].Principal.Service).toEqual('edgelambda.amazonaws.com');
					})
					.then(done, done.fail);
			});
			it('does not change the policy if it already supports lambda@edge', done => {
				underTest(config)
					.then(() =>	iam.getRole({RoleName: newObjects.lambdaRole}).promise())
					.then(result => {
						const policyDocument = unescape((result.Role.AssumeRolePolicyDocument)),
							policy = JSON.parse(policyDocument);
						expect(policy.Statement.length).toEqual(2);
					})
					.then(done, done.fail);
			});
		});
		describe('matching distribution behaviors by path', () => {
			beforeEach(done => {
				config.version = 1;
				createLambda(createConfig)
					.then(done, done.fail);
			});

			it('assigns the events to a specific behavior when the path is set', done => {
				let distributionConfig;
				config['path-pattern'] = '/dev';
				underTest(config)
					.then(() => cloudfront.getDistributionConfig({Id: distributionId}).promise())
					.then(result => distributionConfig = result.DistributionConfig)
					.then(() => extractLambdaAssociations(distributionConfig, '/dev'))
					.then(associations => {
						expect(associations['viewer-request']).toMatch(new RegExp(`${testRunName}:1$`));
						expect(associations['origin-request']).toMatch(new RegExp(`${testRunName}:1$`));
					})
					.then(() => extractLambdaAssociations(distributionConfig))
					.then(associations => {
						expect(associations['viewer-request']).not.toMatch(new RegExp(`${testRunName}:1$`));
						expect(associations['origin-request']).not.toMatch(new RegExp(`${testRunName}:1$`));
					})
					.then(done, done.fail);
			});
			it('blows up if no behavior matches the path pattern', done => {
				let distributionConfig;
				config['path-pattern'] = '/not-exists';
				underTest(config)
					.then(done.fail)
					.catch(e => {
						expect(e).toEqual(`Distribution ${distributionId} does not contain a behavior matching path pattern /not-exists`);
					})
					.then(() => cloudfront.getDistributionConfig({Id: distributionId}).promise())
					.then(result => distributionConfig = result.DistributionConfig)
					.then(() => extractLambdaAssociations(distributionConfig))
					.then(associations => {
						expect(associations['viewer-request']).not.toMatch(new RegExp(`${testRunName}:1$`));
						expect(associations['origin-request']).not.toMatch(new RegExp(`${testRunName}:1$`));
					})
					.then(done, done.fail);
			});
		});

	});
});
