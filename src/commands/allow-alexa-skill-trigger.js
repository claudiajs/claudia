const loadConfig = require('../util/loadconfig'),
	aws = require('aws-sdk');

module.exports = function allowAlexaSkillTrigger(options) {
	'use strict';
	let lambdaConfig,
		lambda;
	const initServices = function () {
			lambda = new aws.Lambda({region: lambdaConfig.region});
		},
		getLambda = () => lambda.getFunctionConfiguration({FunctionName: lambdaConfig.name, Qualifier: options.version}).promise(),
		readConfig = function () {
			return loadConfig(options, {lambda: {name: true, region: true}})
				.then(config => {
					lambdaConfig = config.lambda;
				})
				.then(initServices)
				.then(getLambda)
				.then(result => result.Version);
		},
		addInvokePermission = function (version) {
			return lambda.addPermission({
				Action: 'lambda:InvokeFunction',
				FunctionName: lambdaConfig.name,
				Principal: 'alexa-appkit.amazon.com',
				Qualifier: options.version || version,
				StatementId: `Alexa-${Date.now()}`
			}).promise();
		};
	return readConfig()
		.then(addInvokePermission)
		.then(result => JSON.parse(result.Statement));
};
module.exports.doc = {
	description: 'Allow Alexa Skill triggers',
	priority: 5,
	args: [
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
