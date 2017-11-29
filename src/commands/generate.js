
const path = require('path'),
	fs = require('fs'),
	fsUtil = require('../util/fs-util');

module.exports = function generate(args) {
	'use strict';
	console.log('Generating...');
	const commandTarget = args._ && args._.length && args._[1],
		supportedTemplates = ['hello-world', 'api'],
		source = (args && args.source) || process.cwd(),
		validationError = function () {
			if (!commandTarget) {
				return 'Generate template is missing. If not familiar with the command, run claudia help';
			}

			if (supportedTemplates.indexOf(commandTarget) === -1) {
				return 'Specified template is not supported. If not familiar with the command, run claudia help';
			}

			if (fsUtil.fileExists(path.join(source, `${commandTarget}.js`))) {
				return 'A file with the same name exists at the provided location.';
			}
		},
		generatePackage = function (commandTarget, projectPath) {
			const projectDirectoryName = path.basename(path.dirname(path.join(projectPath, `${commandTarget}.js`)));
			return fsUtil.copy(path.join(__dirname, '../../app-templates/package.json'), path.join(projectPath))
				.then(() => fsUtil.replaceStringInFile(/#{projectName}/g, projectDirectoryName, path.join(projectPath, 'package.json')));
		},
		generateTemplate = function (commandTarget, projectPath) {
			return fsUtil.copy(path.join(__dirname, `../../app-templates/${commandTarget}.js`), projectPath)
			.then(() => {
				if (fsUtil.fileExists(path.join(source, 'package.json'))) {
					return Promise.resolve();
				}
				return generatePackage(commandTarget, projectPath);
			}).then(() => {
				console.log('Generating boring overhead successful');
				return;
			});
		};

	if (validationError()) {
		return Promise.reject(validationError());
	}

	return generateTemplate(commandTarget, source);
};

module.exports.doc = {
	description: 'Create a lambda project template that you can immediatelly deploy',
	priority: 21,
	args: [
		{
			argument: 'hello-world',
			description: 'A hello world project template for your Lambda function'
		},
		{
			argument: 'api',
			description: 'A Claudia API Builder project template for your Lambda function'
		}
	]
};
