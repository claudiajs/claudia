const loadConfig = require('../util/loadconfig'),
	iamNameSanitize = require('../util/iam-name-sanitize'),
	aws = require('aws-sdk'),
	getOwnerInfo = require('../tasks/get-owner-info');
module.exports = function addCognitoUserPoolTrigger(options, optionalLogger) {
	'use strict';
	let lambdaConfig,
		lambda,
		cognito;
	const initServices = function () {
			lambda = new aws.Lambda({region: lambdaConfig.region});
			cognito = new aws.CognitoIdentityServiceProvider({region: lambdaConfig.region});
		},
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true}})
				.then(config => lambdaConfig = config.lambda)
				.then(initServices)
				.then(() => lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name, Qualifier: options.version}).promise())
				.then(result => {
					lambdaConfig.arn = result.FunctionArn;
					lambdaConfig.version = result.Version;
				});
		},
		addInvokePermission = function (poolArn) {
			const result = {
				statementId: iamNameSanitize('lambda_' + Date.now()),
				poolArn: poolArn
			};
			return lambda.addPermission({
				Action: 'lambda:InvokeFunction',
				FunctionName: lambdaConfig.name,
				Principal: 'cognito-idp.amazonaws.com',
				SourceArn: poolArn,
				Qualifier: options.version,
				StatementId: result.statementId
			}).promise().then(() => result);
		},
		getPoolArn = function () {
			return getOwnerInfo(options.region, optionalLogger)
				.then(ownerInfo => `arn:${ownerInfo.partition}:cognito-idp:${lambdaConfig.region}:${ownerInfo.account}:userpool/${options['user-pool-id']}`);
		},
		cleanUpPoolConfig = function (data) {
			/* cognito update requires the full config, not just a patch, but some attributes returned
			 * from describeUserPool are not accepted back into the configuration, so they have to be removed
			 */
			['Id', 'Name', 'LastModifiedDate', 'CreationDate', 'SchemaAttributes', 'EstimatedNumberOfUsers', 'AliasAttributes', 'UsernameAttributes', 'Arn', 'Domain'].forEach(n => delete data[n]);
			if (data.AdminCreateUserConfig && data.AdminCreateUserConfig.UnusedAccountValidityDays) {
				delete data.AdminCreateUserConfig.UnusedAccountValidityDays;
			}
			if (Object.keys(data.UserPoolAddOns || {}).length === 0) {
				delete data.UserPoolAddOns;
			}
		},
		patchPool = function () {
			return cognito.describeUserPool({
				UserPoolId: options['user-pool-id']
			}).promise().then(result => {
				const data = result.UserPool;
				data.UserPoolId = data.Id;
				data.LambdaConfig = data.LambdaConfig || {};
				options.events.split(',').forEach(name => data.LambdaConfig[name] = lambdaConfig.arn);
				cleanUpPoolConfig(data);
				return cognito.updateUserPool(data).promise();
			});
		};
	if (!options.events) {
		return Promise.reject('events not specified. provide with --events');
	}
	if (!options['user-pool-id']) {
		return Promise.reject('user pool id not specified. provide with --user-pool-id');
	}

	return readConfig()
		.then(patchPool)
		.then(getPoolArn)
		.then(addInvokePermission);
};

module.exports.doc = {
	description: 'Configures the Lambda to run on a Cognito User Pool trigger',
	priority: 5,
	args: [
		{
			argument: 'user-pool-id',
			description: 'the Cognito User Pool ID',
			example: 'us-east-1_2abcDEFG'
		},
		{
			argument: 'events',
			description: 'Names of triggers to set up (use comma to separate multiple events). See http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CognitoIdentityServiceProvider.html#updateUserPool-property for valid names',
			example: 'PreSignUp,PreAuthentication'
		},
		{
			argument: 'version',
			optional: true,
			description: 'Bind to a particular version',
			example: 'production',
			default: 'latest version'
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
		}
	]
};
