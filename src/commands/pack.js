const path = require('path'),
	fsUtil = require('../util/fs-util'),
	zipdir = require('../tasks/zipdir'),
	readjson = require('../util/readjson'),
	collectFiles = require('../tasks/collect-files'),
	cleanUpPackage = require('../tasks/clean-up-package'),
	fsPromise = require('../util/fs-promise'),
	expectedArchiveName = require('../util/expected-archive-name'),
	os = require('os'),
	NullLogger = require('../util/null-logger');
module.exports = function pack(options, optionalLogger) {
	'use strict';
	let workingDir, outputFileName = options.output && path.resolve(options.output);
	const logger = optionalLogger || new NullLogger(),
		source = (options && options.source) || process.cwd(),
		packageConfPath = path.join(source, 'package.json'),
		validationError = function () {
			if (source === os.tmpdir()) {
				return 'Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.';
			}
			if (options['optional-dependencies'] === false && options['use-local-dependencies']) {
				return 'incompatible arguments --use-local-dependencies and --no-optional-dependencies';
			}
			if (!fsUtil.fileExists(packageConfPath)) {
				return 'package.json does not exist in the source folder';
			}
		},
		cleanup = (result) => {
			fsUtil.rmDir(workingDir);
			return result;
		};
	if (validationError()) {
		return Promise.reject(validationError());
	}
	return fsPromise.mkdtempAsync(os.tmpdir() + path.sep)
	.then(dir => workingDir = dir)
	.then(() => {
		if (!outputFileName) {
			return readjson(packageConfPath)
				.then(packageConf => outputFileName = path.resolve(expectedArchiveName(packageConf, '.zip')));
		}
	})
	.then(() => {
		if (!options.force && fsUtil.fileExists(outputFileName)) {
			throw `${outputFileName} already exists. Use --force to overwrite it.`;
		}
	})
	.then(() => collectFiles(source, workingDir, options, logger))
	.then(dir => cleanUpPackage(dir, options, logger))
	.then(dir => {
		logger.logStage('zipping package');
		return zipdir(dir);
	})
	.then(zipFile => fsUtil.move(zipFile, outputFileName))
	.then(cleanup)
	.then(() => ({
		output: outputFileName
	}));
};

module.exports.doc = {
	description: 'Package a zip file for uploading to Lambda with all the required NPM dependencies, without deploying it anywhere.\nWorks with any JavaScript Lambda project, not just Claudia-related deployments.',
	priority: 4,
	args: [
		{
			argument: 'output',
			optional: true,
			description: 'Output file path',
			default: 'File in the current directory named after the NPM package name and version'
		},
		{
			argument: 'force',
			optional: true,
			description: 'If set, existing output files will be overwritten',
			default: 'not set, so trying to write over an existing output file will result in an error'
		},
		{
			argument: 'source',
			optional: true,
			description: 'Directory with project files',
			'default': 'current directory'
		},
		{
			argument: 'no-optional-dependencies',
			optional: true,
			description: 'Do not pack optional dependencies.'
		},
		{
			argument: 'use-local-dependencies',
			optional: true,
			description: 'Do not install dependencies, use the local node_modules directory instead'
		},
		{
			argument: 'npm-options',
			optional: true,
			description: 'Any additional options to pass on to NPM when installing packages. Check https://docs.npmjs.com/cli/install for more information',
			example: '--ignore-scripts',
			since: '5.0.0'
		},
		{
			argument: 'post-package-script',
			optional: true,
			example: 'customNpmScript',
			description: 'the name of a NPM script to execute custom processing after claudia finished packaging your files.\n' +
				'Note that development dependencies are not available at this point, but you can use npm uninstall to remove utility tools as part of this step.',
			since: '5.0.0'
		}
	]
};
