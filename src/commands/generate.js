
const path = require('path'),
	fsUtil = require('../util/fs-util');

module.exports = function generate(args) {
	'use strict';
	console.log('Generating...');
	const commandTarget = args._ && args._.length && args._[1],
		supportedTemplates = ['hello-world', 'api'],
		source = (args && args.source) || process.cwd(),
		validationError = function () {
			if (!args.region) {
				return 'AWS region is missing. please specify with --region.';
			}

			if (!commandTarget) {
				return 'Generate template is missing. If not familiar with the command, run claudia help.';
			}

			if (supportedTemplates.indexOf(commandTarget) === -1) {
				return 'Specified template is not supported. If not familiar with the command, run claudia help.';
			}

			if (fsUtil.fileExists(path.join(source, `${commandTarget}.js`))) {
				return 'A file with the same name exists at the provided location.';
			}
		},
		generatePackage = function (projectPath, region) {
			const srcPath = path.join(__dirname, '../../app-templates/package.json'),
				destPath = path.join(projectPath, 'package.json');
			return fsUtil.copyAndReplaceInFile(/#{projectName}/g, path.basename(projectPath), srcPath, destPath)
			.then(() => fsUtil.replaceStringInFile('#{region}', region, destPath));
		},
		generateTemplate = function (commandTarget, projectPath) {
			return fsUtil.copyFile(path.join(__dirname, `../../app-templates/${commandTarget}.js`), path.join(projectPath, `${commandTarget}.js`))
			.then(() => {
				if (fsUtil.fileExists(path.join(projectPath, 'package.json'))) {
					return Promise.resolve();
				}
				return generatePackage(projectPath, args.region);
			}).then(() => {
				console.log('Generating template successful');
				return;
			});
		};

	if (validationError()) {
		return Promise.reject(validationError());
	}
	return generateTemplate(commandTarget, source);
};

module.exports.doc = {
	description: 'Create a lambda project template that you can immediately deploy',
	priority: 21,
	args: [
		{
			argument: 'hello-world',
			description: 'A hello world project template for your Lambda function'
		},
		{
			argument: 'api',
			description: 'A Claudia API Builder project template for your Lambda function'
		},
		{
			argument: 'region',
			description: 'AWS region where to create the lambda',
			example: 'us-east-1'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			'default': 'current directory'
		}
	]
};
