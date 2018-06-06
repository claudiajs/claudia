const path = require('path'),
	fsPromise = require('../util/fs-promise'),
	fsUtil = require('../util/fs-util'),
	NullLogger = require('../util/null-logger'),
	runNpm = require('../util/run-npm');
module.exports = function generateServerlessExpressProxy(options, optionalLogger) {
	'use strict';
	const source = (options && options.source) || process.cwd(),
		logger = optionalLogger || new NullLogger(),
		serverlessModule = (options && options['aws-serverless-express-module']) || 'aws-serverless-express',
		proxyModuleName = (options && options['proxy-module-name']) || 'lambda',
		proxyModulePath = path.join(source, `${proxyModuleName}.js`),
		expressModule = options && options['express-module'],
		installDependencies = targetDir => runNpm(targetDir, ['install', serverlessModule, '-S'], logger);

	if (!expressModule) {
		return Promise.reject('please specify express app module with --express-module');
	}
	if (!fsUtil.fileExists(path.join(source, expressModule + '.js'))) {
		return Promise.reject(`the target directory does not contain ${expressModule}.js`);
	}
	if (!fsUtil.fileExists(path.join(source, 'package.json'))) {
		return Promise.reject('the target directory is not a node.js project');
	}
	if (fsUtil.fileExists('-e', proxyModulePath)) {
		return Promise.reject(proxyModuleName + '.js already exists in the target directory');
	}
	if (proxyModuleName.indexOf('/') >= 0) {
		return Promise.reject(proxyModuleName + '.js cannot be in a subdirectory');
	}
	return installDependencies(source)
	.then(() => {
		const contents = `'use strict'
const awsServerlessExpress = require('aws-serverless-express')
const app = require('./${expressModule}')
const binaryMimeTypes = [
	'application/octet-stream',
	'font/eot',
	'font/opentype',
	'font/otf',
	'image/jpeg',
	'image/png',
	'image/svg+xml'
]
const server = awsServerlessExpress.createServer(app, null, binaryMimeTypes);
exports.handler = (event, context) => awsServerlessExpress.proxy(server, event, context)
`;

		return fsPromise.writeFileAsync(proxyModulePath, contents, 'utf8');
	})
	.then(() => ({
		'lambda-handler': proxyModuleName + '.handler'
	}));
};
module.exports.doc = {
	description: 'Create a lambda proxy API wrapper for an express app using aws-serverless-express',
	priority: 20,
	args: [
		{
			argument: 'express-module',
			description: 'The main module that exports your express application',
			example: 'if the application is defined and exported from express-server.js, this would be express-server'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			'default': 'current directory'
		},
		{
			argument: 'proxy-module-name',
			optional: true,
			description: 'the name of the new proxy module/file that will be created. To create a file called web-lambda.js, this would be web-lambda',
			default: 'lambda'
		},
		{
			argument: 'aws-serverless-express-module',
			optional: true,
			description: 'the NPM module name/path of the serverless-express module you want to install',
			default: 'aws-serverless-express'
		}
	]
};
