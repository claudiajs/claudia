const readjson = require('../util/readjson'),
	runNpm = require('../util/run-npm'),
	fsUtil = require('../util/fs-util'),
	extractTar = require('../util/extract-tar'),
	fsPromise = require('../util/fs-promise'),
	path = require('path'),
	NullLogger = require('../util/null-logger'),
	packProjectToTar = require('../util/pack-project-to-tar');

/*
 * Creates a directory with a NPM project and all production dependencies localised,
 * ready for zipping and uploading to lambda. It will also rewire all local file: dependencies
 * correctly to work with NPM5
 *
 * Arguments:
 *
 * - sourcePath: a path to a NPM project directory, containing package.json
 * - workingDir: a directory where it is safe to create files, the resulting dir will be a subdirectory here
 * - useLocalDependencies: boolean -- if true, existing node_modules will be copied instead of reinstalling
 * - optionalLogger: log reporter
 *
 * Returns:
 *
 * A path to a directory containing all dependencies. Other files required to reinstall the package will be stored in the workingDir
 */
module.exports = function collectFiles(sourcePath, workingDir, options, optionalLogger) {
	'use strict';
	const logger = optionalLogger || new NullLogger(),
		runQuietly = options && options.quiet,
		useLocalDependencies = options && options['use-local-dependencies'],
		npmOptions = (options && options['npm-options']) ? options['npm-options'].split(' ') : [],
		checkPreconditions = function (providedSourcePath) {
			if (!providedSourcePath) {
				return 'source directory not provided';
			}
			if (!fsUtil.fileExists(providedSourcePath)) {
				return 'source directory does not exist';
			}
			if (!fsUtil.isDir(providedSourcePath)) {
				return 'source path must be a directory';
			}
			if (!workingDir) {
				return 'working directory not provided';
			}
			if (!fsUtil.fileExists(workingDir)) {
				return 'working directory does not exist';
			}
			if (!fsUtil.isDir(workingDir)) {
				return 'working directory must be a directory';
			}

			if (!fsUtil.fileExists(path.join(providedSourcePath, 'package.json'))) {
				return 'source directory does not contain package.json';
			}
		},
		copyIfExists = function (targetDir, referencedir, fileNames) {
			fileNames.forEach(fileName => {
				const filePath = path.join(referencedir, fileName);
				if (fsUtil.fileExists(filePath)) {
					fsUtil.copy(filePath, targetDir);
				}
			});
			return targetDir;
		},
		cleanCopyToDir = function (projectDir) {
			return packProjectToTar(projectDir, workingDir, npmOptions, logger)
			.then(archive => extractTar(archive, path.dirname(archive)))
			.then(archiveDir => path.join(archiveDir, 'package'))
			.then(dir => copyIfExists(dir, projectDir, ['.npmrc', 'package-lock.json']));
		},
		installDependencies = function (targetDir) {
			if (useLocalDependencies) {
				fsUtil.copy(path.join(sourcePath, 'node_modules'), targetDir);
				return Promise.resolve(targetDir);
			} else {
				return runNpm(targetDir, ['install',  '-q', '--no-audit', '--production'].concat(npmOptions), logger, runQuietly);
			}
		},
		isRelativeDependency = function (dependency) {
			return (dependency && typeof dependency === 'string' && (dependency.startsWith('file:')
				|| dependency.startsWith('.') || dependency.startsWith('/')));
		},
		hasRelativeDependencies = function (packageConf) {
			return ['dependencies', 'devDependencies', 'optionalDependencies'].find(depType => {
				const subConf = packageConf[depType];
				return subConf && Object.keys(subConf).map(key => subConf[key]).find(isRelativeDependency);
			});
		},
		activeRemapPromise = {},
		remapSingleDep = function (dependencyPath, referencePath) {
			if (!isRelativeDependency(dependencyPath)) {
				throw new Error('invalid relative dependency path ' + dependencyPath);
			}
			const actualPath = path.resolve(referencePath, dependencyPath.replace(/^file:/, ''));
			if (fsUtil.isFile(actualPath)) {
				return Promise.resolve('file:' + actualPath);
			}
			if (fsUtil.isDir(actualPath)) {
				if (!activeRemapPromise[actualPath]) {
					activeRemapPromise[actualPath] = readjson(path.join(actualPath, 'package.json'))
					.then(packageConf => {
						if (!hasRelativeDependencies(packageConf)) {
							return packProjectToTar(actualPath, workingDir, npmOptions, logger);
						}
						return cleanCopyToDir(actualPath)
							.then(cleanCopyPath => rewireRelativeDependencies(cleanCopyPath, actualPath)) // eslint-disable-line no-use-before-define
							.then(cleanCopyPath => packProjectToTar(cleanCopyPath, workingDir, npmOptions, logger));
					})
					.then(remappedPath =>  'file:' + remappedPath);
				}
				return activeRemapPromise[actualPath];
			}
			throw new Error(`${dependencyPath} points to ${actualPath}, which is neither dir nor a file, cannot remap.`);
		},
		remapDependencyType = function (subConfig, referenceDir) {
			if (!subConfig) {
				return false;
			}
			const keys = Object.keys(subConfig),
				relativeDeps = keys.filter(key => isRelativeDependency(subConfig[key]));
			if (!relativeDeps.length) {
				return false;
			}
			return Promise.all(relativeDeps.map(key => remapSingleDep(subConfig[key], referenceDir)))
			.then(results => results.forEach((val, index) => subConfig[relativeDeps[index]] = val))
			.then(() => true);
		},
		rewireRelativeDependencies = function (targetDir, referenceDir) {
			const confPath = path.join(targetDir, 'package.json');
			return readjson(confPath)
			.then(packageConfig => {
				if (hasRelativeDependencies(packageConfig)) {
					if (packageConfig.devDependencies) {
						delete packageConfig.devDependencies;
					}
					return Promise.all(['dependencies', 'optionalDependencies'].map(t => remapDependencyType(packageConfig[t], referenceDir)))
					.then(() => fsPromise.writeFileAsync(confPath, JSON.stringify(packageConfig, null, 2), 'utf8'))
					.then(() => fsUtil.silentRemove(path.join(targetDir, 'package-lock.json')));
				}
			})
			.then(() => targetDir);
		},
		validationError = checkPreconditions(sourcePath);
	logger.logStage('packaging files');
	if (validationError) {
		return Promise.reject(validationError);
	}
	return cleanCopyToDir(sourcePath)
	.then(copyDir => rewireRelativeDependencies(copyDir, sourcePath))
	.then(installDependencies);
};
