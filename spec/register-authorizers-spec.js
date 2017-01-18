/*global describe, it, beforeEach, afterEach, expect, it */
const underTest = require('../src/tasks/register-authorizers'),
	destroyObjects = require('./util/destroy-objects'),
	genericTestRole = require('./util/generic-role'),
	create = require('../src/commands/create'),
	shell = require('shelljs'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	aws = require('aws-sdk'),
	retriableWrap = require('../src/util/retriable-wrap'),
	awsRegion = require('./util/test-aws-region');

describe('registerAuthorizers', () => {
	'use strict';
	let authorizerLambdaName, workingdir, testRunName, newObjects, apiId, authorizerArn, ownerId;
	const apiGateway = retriableWrap(new aws.APIGateway({ region: awsRegion })),
		lambda = new aws.Lambda({ region: awsRegion }),
		iam = new aws.IAM({ region: awsRegion }),
		checkAuthUri = function (uri) {
			expect(uri).toMatch(/^arn:aws:apigateway:[a-z0-9-]+:lambda:path\/2015-03-31\/functions\/arn:aws:lambda:[a-z0-9-]+:[0-9]+:function:test[0-9]+auth\/invocations$/);
			expect(uri.split(':')[11]).toEqual(testRunName + 'auth/invocations');
		},
		checkAuthUriWithVersion = function (uri, version) {
			expect(uri).toEqual(`arn:aws:apigateway:${awsRegion}:lambda:path/2015-03-31/functions/${authorizerArn}:${version}/invocations`);
		};

	beforeEach(done => {
		let authorizerLambdaDir;
		workingdir = tmppath();
		testRunName = 'test' + Date.now();

		newObjects = { workingdir: workingdir };
		shell.mkdir(workingdir);
		shell.cp('-r', 'spec/test-projects/echo/*', workingdir);
		create({ name: testRunName, version: 'original', role: genericTestRole.get(), region: awsRegion, source: workingdir, handler: 'main.handler' })
		.then(result => {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		})
		.then(() => apiGateway.createRestApiPromise({ name: testRunName }))
		.then(result => {
			apiId = result.id;
			newObjects.restApi = result.id;
		})
		.then(() => {
			authorizerLambdaDir = path.join(workingdir, 'authorizer');
			shell.mkdir(authorizerLambdaDir);
			shell.cp('-r', 'spec/test-projects/echo/*', authorizerLambdaDir);
			return create({ name: testRunName + 'auth', version: 'original', role: genericTestRole.get(), region: awsRegion, source: authorizerLambdaDir, handler: 'main.handler' });
		})
		.then(result => {
			authorizerLambdaName = result.lambda && result.lambda.name;
			return lambda.getFunctionConfiguration({ FunctionName: authorizerLambdaName }).promise();
		})
		.then(lambdaConfig => {
			authorizerArn = lambdaConfig.FunctionArn;
		})
		.then(() => {
			ownerId = authorizerArn.split(':')[4];
		})
		.then(done, e => {
			console.log('error setting up', e);
			done.fail();
		});
	});
	afterEach(done => {
		destroyObjects(newObjects)
		.then(() => {
			if (authorizerLambdaName) {
				return lambda.deleteFunction({FunctionName: authorizerLambdaName}).promise();
			}
		})
		.then(done, done.fail);
	});
	it('does nothing when authorizers are not defined', done => {
		underTest(false, apiId, awsRegion)
		.then(createResult => expect(createResult).toEqual({}))
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => expect(authorizers.items).toEqual([]))
		.then(done, done.fail);
	});
	it('creates header-based authorizers', done => {
		const authorizerConfig = {
			first: {
				lambdaName: authorizerLambdaName, headerName: 'Authorization'
			}
		};
		let result;
		underTest(authorizerConfig, apiId, awsRegion)
		.then(createResult => {
			result = createResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			expect(authorizers.items.length).toEqual(1);
			expect(result.first).toEqual(authorizers.items[0].id);
			expect(authorizers.items[0].name).toEqual('first');
			expect(authorizers.items[0].type).toEqual('TOKEN');
			expect(authorizers.items[0].authorizerCredentials).toBeFalsy();
			expect(authorizers.items[0].authorizerResultTtlInSeconds).toBeFalsy();
			expect(authorizers.items[0].identityValidationExpression).toBeFalsy();
			expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
			checkAuthUri(authorizers.items[0].authorizerUri);
		})
		.then(done, done.fail);
	});
	it('assigns a token validation regex if supplied', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName,  validationExpression: 'A-Z' }
		};
		underTest(authorizerConfig, apiId, awsRegion)
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => expect(authorizers.items[0].identityValidationExpression).toEqual('A-Z'))
		.then(done, done.fail);
	});
	it('assigns authorizer credentials if supplied', done => {
		let roleArn;
		iam.getRole({ RoleName: genericTestRole.get() }).promise()
		.then(roleDetails => {
			roleArn = roleDetails.Role.Arn;
			expect(roleArn).toBeTruthy();
		})
		.then(() => {
			const authorizerConfig = {
				first: { lambdaName: authorizerLambdaName,  credentials: roleArn }
			};
			return underTest(authorizerConfig, apiId, awsRegion);
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => expect(authorizers.items[0].authorizerCredentials).toEqual(roleArn))
		.then(done, done.fail);
	});
	it('assigns authorizer ttl in seconds if supplied', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName,  resultTtl: 5 }
		};
		let result;
		underTest(authorizerConfig, apiId, awsRegion)
		.then(createResult => {
			result = createResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			expect(authorizers.items.length).toEqual(1);
			expect(result.first).toEqual(authorizers.items[0].id);
			expect(authorizers.items[0].authorizerResultTtlInSeconds).toEqual(5);
			checkAuthUri(authorizers.items[0].authorizerUri);
		})
		.then(done, done.fail);
	});
	it('uses the Authorization header by default', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName }
		};
		let result;
		underTest(authorizerConfig, apiId, awsRegion)
		.then(createResult => {
			result = createResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			expect(authorizers.items.length).toEqual(1);
			expect(result.first).toEqual(authorizers.items[0].id);
			expect(authorizers.items[0].name).toEqual('first');
			expect(authorizers.items[0].type).toEqual('TOKEN');
			expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
			checkAuthUri(authorizers.items[0].authorizerUri);
		})
		.then(done, done.fail);
	});
	it('creates multiple authorizers', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName, headerName: 'Authorization' },
			second: { lambdaName: authorizerLambdaName, headerName: 'UserId' }
		};
		let result;
		underTest(authorizerConfig, apiId, awsRegion)
		.then(creationResult => {
			result = creationResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			const auths = {};
			expect(authorizers.items.length).toEqual(2);
			auths[authorizers.items[0].name] = authorizers.items[0];
			auths[authorizers.items[1].name] = authorizers.items[1];

			expect(result.first).toEqual(auths.first.id);
			expect(auths.first.type).toEqual('TOKEN');
			expect(auths.first.identitySource).toEqual('method.request.header.Authorization');
			checkAuthUri(auths.first.authorizerUri);

			expect(result.second).toEqual(auths.second.id);
			expect(auths.second.type).toEqual('TOKEN');
			expect(auths.second.identitySource).toEqual('method.request.header.UserId');
			checkAuthUri(auths.second.authorizerUri);
		})
		.then(done, done.fail);
	});
	it('overrides existing authorizers', done => {
		let result;
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName, headerName: 'NewFirst' },
			third: { lambdaName: authorizerLambdaName, headerName: 'NewThird' }
		};
		apiGateway.createAuthorizerPromise({
			identitySource: 'method.request.header.OldFirst',
			name: 'first',
			restApiId: apiId,
			type: 'TOKEN',
			authorizerUri: `arn:aws:apigateway:${awsRegion}:lambda:path/2015-03-31/functions/${authorizerArn}/invocations`
		})
		.then(() => {
			return apiGateway.createAuthorizerPromise({
				identitySource: 'method.request.header.OldSecond',
				name: 'second',
				restApiId: apiId,
				type: 'TOKEN',
				authorizerUri: `arn:aws:apigateway:${awsRegion}:lambda:path/2015-03-31/functions/${authorizerArn}/invocations`
			});
		})
		.then(() => underTest(authorizerConfig, apiId, awsRegion))
		.then(creationResult => {
			result = creationResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			const auths = {};
			expect(authorizers.items.length).toEqual(2);
			auths[authorizers.items[0].name] = authorizers.items[0];
			auths[authorizers.items[1].name] = authorizers.items[1];

			expect(auths.first.type).toEqual('TOKEN');
			expect(result.first).toEqual(auths.first.id);
			expect(auths.first.identitySource).toEqual('method.request.header.NewFirst');
			checkAuthUri(auths.first.authorizerUri);

			expect(auths.third.type).toEqual('TOKEN');
			expect(result.third).toEqual(auths.third.id);
			expect(auths.third.identitySource).toEqual('method.request.header.NewThird');
			checkAuthUri(auths.third.authorizerUri);
		})
		.then(done, done.fail);
	});
	it('creates authorizers using an ARN', done => {
		const authorizerConfig = {
			first: { lambdaArn: authorizerArn }
		};
		let result;
		underTest(authorizerConfig, apiId, awsRegion)
		.then(createResult => {
			result = createResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			expect(authorizers.items.length).toEqual(1);
			expect(result.first).toEqual(authorizers.items[0].id);
			expect(authorizers.items[0].name).toEqual('first');
			expect(authorizers.items[0].type).toEqual('TOKEN');
			expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
			checkAuthUri(authorizers.items[0].authorizerUri);
		})
		.then(done, done.fail);
	});
	it('creates authorizers qualified by lambda name and current stage', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName, lambdaVersion: true }
		};
		let result;
		underTest(authorizerConfig, apiId, awsRegion)
		.then(createResult => {
			result = createResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			expect(authorizers.items.length).toEqual(1);
			expect(result.first).toEqual(authorizers.items[0].id);
			expect(authorizers.items[0].name).toEqual('first');
			expect(authorizers.items[0].type).toEqual('TOKEN');
			expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
			checkAuthUriWithVersion(authorizers.items[0].authorizerUri, '${stageVariables.lambdaVersion}');
		})
		.then(done, done.fail);
	});
	it('creates authorizers qualified by a specific value', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName, lambdaVersion: 'original' }
		};
		let result;
		underTest(authorizerConfig, apiId, awsRegion)
		.then(createResult => {
			result = createResult;
		})
		.then(() => apiGateway.getAuthorizersPromise({ restApiId: apiId }))
		.then(authorizers => {
			expect(authorizers.items.length).toEqual(1);
			expect(result.first).toEqual(authorizers.items[0].id);
			expect(authorizers.items[0].name).toEqual('first');
			expect(authorizers.items[0].type).toEqual('TOKEN');
			expect(authorizers.items[0].identitySource).toEqual('method.request.header.Authorization');
			checkAuthUriWithVersion(authorizers.items[0].authorizerUri, 'original');
		})
		.then(done, done.fail);
	});
	it('allows api gateway to invoke the authorizer lambda without qualifier', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName }
		};
		underTest(authorizerConfig, apiId, awsRegion)
		.then(() => {
			return lambda.getPolicy({
				FunctionName: authorizerLambdaName
			}).promise();
		})
		.then(policyResponse => policyResponse && policyResponse.Policy && JSON.parse(policyResponse.Policy))
		.then(currentPolicy => {
			expect(currentPolicy.Statement[0].Condition.ArnLike['AWS:SourceArn']).toMatch(`arn:aws:execute-api:${awsRegion}:${ownerId}:${apiId}/authorizers/*`);
			expect(currentPolicy.Statement[0].Effect).toEqual('Allow');
		})
		.then(done, done.fail);
	});
	it('allows api gateway to invoke the authorizer lambda with a hard-coded qualifier', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName, lambdaVersion: 'original' }
		};
		underTest(authorizerConfig, apiId, awsRegion, 'development')
		.then(() => {
			return lambda.getPolicy({
				FunctionName: authorizerLambdaName,
				Qualifier: 'original'
			}).promise();
		})
		.then(policyResponse => policyResponse && policyResponse.Policy && JSON.parse(policyResponse.Policy))
		.then(currentPolicy => {
			expect(currentPolicy.Statement[0].Condition.ArnLike['AWS:SourceArn']).toMatch('arn:aws:execute-api:' + awsRegion + ':' + ownerId + ':' + apiId + '/authorizers/*');
			expect(currentPolicy.Statement[0].Effect).toEqual('Allow');
		})
		.then(done, done.fail);
	});
	it('allows api gateway to invoke the authorizer lambda with a current version qualifier', done => {
		const authorizerConfig = {
			first: { lambdaName: authorizerLambdaName, lambdaVersion: true }
		};
		underTest(authorizerConfig, apiId, awsRegion, 'original')
		.then(() => {
			return lambda.getPolicy({
				FunctionName: authorizerLambdaName,
				Qualifier: 'original'
			}).promise();
		})
		.then(policyResponse => policyResponse && policyResponse.Policy && JSON.parse(policyResponse.Policy))
		.then(currentPolicy => {
			expect(currentPolicy.Statement[0].Condition.ArnLike['AWS:SourceArn']).toMatch('arn:aws:execute-api:' + awsRegion + ':' + ownerId + ':' + apiId + '/authorizers/*');
			expect(currentPolicy.Statement[0].Effect).toEqual('Allow');
		})
		.then(done, done.fail);
	});
	it('does not assign policies when the authorizer is specified with an ARN', done => {
		const authorizerConfig = {
			first: { lambdaArn: authorizerArn }
		};
		underTest(authorizerConfig, apiId, awsRegion, 'original')
		.then(() => {
			return lambda.getPolicy({
				FunctionName: authorizerLambdaName
			}).promise();
		})
		.then(done.fail, err => expect(err.message).toEqual('The resource you requested does not exist.'))
		.then(done);
	});
});
