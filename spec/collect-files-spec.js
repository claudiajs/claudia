/*global describe, it, beforeEach, afterEach, expect, process */
const underTest = require('../src/tasks/collect-files'),
	os = require('os'),
	fs = require('fs'),
	runNpm = require('../src/util/run-npm'),
	ArrayLogger = require('../src/util/array-logger'),
	tmppath = require('../src/util/tmppath'),
	fsPromise = require('../src/util/fs-promise'),
	readjson = require('../src/util/readjson'),
	NullLogger = require('../src/util/null-logger'),
	fsUtil = require('../src/util/fs-util'),
	packProjectToTar = require('../src/util/pack-project-to-tar'),
	path = require('path');
describe('collectFiles', () => {
	'use strict';
	let sourcedir, workingdir, pwd;
	const configurePackage = function (packageConf) {
			packageConf.name = packageConf.name || 'testproj';
			packageConf.version = packageConf.version || '1.0.0';
			packageConf.repository = '/';
			packageConf.license = 'UNLICENSED';
			packageConf.description = 'npm is whiny';
			fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify(packageConf), 'utf8');
		},
		isSubDir = function (dir1, dir2) {
			return path.relative(dir1, dir2).startsWith('..');
		},
		setupDep = function (name, deps, devDeps) {
			const depdir = path.join(workingdir, name);
			fs.mkdirSync(depdir);
			fs.writeFileSync(path.join(depdir, 'package.json'), JSON.stringify({name: name, version: '1.0.0', dependencies: deps, devDependencies: devDeps }), 'utf8');
			fs.writeFileSync(path.join(depdir, name + '.js'), 'hello there', 'utf8');
		},
		nullLogger = new NullLogger();

	beforeEach(done => {
		pwd = process.cwd();
		fsPromise.mkdtempAsync(os.tmpdir() + path.sep)
		.then(dir => {
			workingdir = path.resolve(dir);
			sourcedir = path.join(workingdir, 'source');
			fs.mkdirSync(sourcedir);
			fs.writeFileSync(path.join(sourcedir, 'root.txt'), 'text1', 'utf8');
			fs.writeFileSync(path.join(sourcedir, 'excluded.txt'), 'excl1', 'utf8');
			fs.mkdirSync(path.join(sourcedir, 'subdir'));
			fs.writeFileSync(path.join(sourcedir, 'subdir', 'sub.txt'), 'text2', 'utf8');
		})
		.then(done, done.fail);
	});
	afterEach(() => {
		process.chdir(pwd);
		fsUtil.rmDir(workingdir);
	});
	it('fails if the source directory is not provided', done => {
		underTest()
		.then(done.fail, message => {
			expect(message).toEqual('source directory not provided');
		})
		.then(done, done.fail);
	});
	it('fails if the working directory is not specified', done => {
		underTest(sourcedir)
		.then(done.fail, message => {
			expect(message).toEqual('working directory not provided');
		})
		.then(done, done.fail);
	});
	it('fails if the source directory does not exist', done => {
		underTest(tmppath(), workingdir)
		.then(done.fail, message => {
			expect(message).toEqual('source directory does not exist');
		})
		.then(done, done.fail);
	});
	it('fails if the working directory does not exist', done => {
		underTest(sourcedir, tmppath())
		.then(done.fail, message => {
			expect(message).toEqual('working directory does not exist');
		})
		.then(done, done.fail);
	});
	it('fails if the source directory is not a directory', done => {
		const filePath = path.join(sourcedir, 'file.txt');
		fs.writeFileSync(filePath, '{}', 'utf8');
		underTest(filePath, workingdir)
		.then(done.fail, message => {
			expect(message).toEqual('source path must be a directory');
		})
		.then(done, done.fail);
	});
	it('fails if the working directory is not a directory', done => {
		const filePath = path.join(sourcedir, 'file.txt');
		fs.writeFileSync(filePath, '{}', 'utf8');
		underTest(sourcedir, filePath)
		.then(done.fail, message => {
			expect(message).toEqual('working directory must be a directory');
		})
		.then(done, done.fail);
	});
	it('fails if package.json does not exist in the source directory', done => {
		underTest(sourcedir, workingdir)
		.then(done.fail, message => {
			expect(message).toEqual('source directory does not contain package.json');
		})
		.then(done, done.fail);
	});
	describe('when the files property is specified', () => {
		it('it limits the files copied to the files property', done => {
			configurePackage({ files: ['roo*'] });
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(fsUtil.fileExists(path.join(packagePath, 'excluded.txt'))).toBeFalsy();
				expect(fsUtil.fileExists(path.join(packagePath, 'subdir'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('works when files is a single string', done => {
			configurePackage({ files: ['root.txt'] });
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(fsUtil.fileExists(path.join(packagePath, 'excluded.txt'))).toBeFalsy();
				expect(fsUtil.fileExists(path.join(packagePath, 'subdir'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('copies all the listed files/subfolders/with wildcards from the files property to a folder in the working path', done => {
			configurePackage({ files: ['roo*', 'subdir'] });
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(isSubDir(path.dirname(packagePath), workingdir)).toBeTruthy();
				expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
				expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
				done();
			}, done.fail);
		});
		it('includes package.json even if it is not in the files property', done => {
			configurePackage({ files: ['roo*'] });
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'package.json'))).toBeTruthy();
				done();
			}, done.fail);
		});
		['.gitignore', '.npmignore'].forEach(fileName => {
			it(`ignores ${fileName}`, done => {
				fs.writeFileSync(path.join(sourcedir, fileName), 'root.txt', 'utf8');
				configurePackage({files: ['roo*']});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(fsUtil.fileExists(path.join(packagePath, 'subdir'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
		});
	});
	describe('when the files property is not specified', () => {
		it('copies all the project files to a folder in the working path', done => {
			configurePackage({});
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(isSubDir(path.dirname(packagePath), workingdir)).toBeTruthy();
				expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
				expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
				expect(fs.readFileSync(path.join(packagePath, 'excluded.txt'), 'utf8')).toEqual('excl1');
			})
			.then(done, done.fail);
		});
		it('includes package.json even if it is not in the files property', done => {
			configurePackage({});
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'package.json'))).toBeTruthy();
			})
			.then(done, done.fail);
		});
		['node_modules', '.git', '.hg', '.svn', 'CVS'].forEach(dirName => {
			it(`excludes ${dirName} directory from the package`, done => {
				fs.mkdirSync(path.join(sourcedir, dirName));
				fs.writeFileSync(path.join(sourcedir, dirName, 'sub.txt'), 'text2', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, dirName, 'sub.txt'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
		});
		['.gitignore', '.somename.swp', '._somefile', '.DS_Store', 'npm-debug.log'].forEach(fileName => {
			it(`excludes ${fileName} file from the package`, done => {
				fs.writeFileSync(path.join(sourcedir, fileName), 'text2', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, fileName))).toBeFalsy();
				})
				.then(done, done.fail);
			});
		});
		it('leaves .npmrc if it exists', done => {
			const fileName = '.npmrc';
			fs.writeFileSync(path.join(sourcedir, fileName), 'text2', 'utf8');
			configurePackage({});
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, fileName))).toBeTruthy();
			})
			.then(done, done.fail);
		});
		['.gitignore', '.npmignore'].forEach(fileName => {
			it(`ignores the wildcard contents specified in ${fileName}`, done => {
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(fsUtil.fileExists(path.join(packagePath, 'subdir'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
			it(`ignores node_modules even when a separate ignore is specified in ${fileName}`, done => {
				fs.mkdirSync(path.join(sourcedir, 'node_modules'));
				fs.writeFileSync(path.join(sourcedir, 'node_modules', 'sub.txt'), 'text2', 'utf8');
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'sub.txt'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
			it(`survives blank and comment lines in ignore file lists for ${fileName}`, done => {
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir\n\n#root.txt', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(fsUtil.fileExists(path.join(packagePath, 'subdir'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
		});
		it('empty .npmignore files do not cause .gitignore to be ignored', done => {
			fs.writeFileSync(path.join(sourcedir, '.gitignore'), 'root.txt\nsubdir', 'utf8');
			fs.writeFileSync(path.join(sourcedir, '.npmignore'), '', 'utf8');
			configurePackage({});
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(fsUtil.fileExists(path.join(packagePath, 'subdir'))).toBeTruthy();
			})
			.then(done, done.fail);
		});

	});
	describe('collecting dependencies', () => {
		beforeEach(() => {
			fs.mkdirSync(path.join(sourcedir, 'node_modules'));
			fs.mkdirSync(path.join(sourcedir, 'node_modules', 'old-mod'));
			fs.writeFileSync(path.join(sourcedir, 'node_modules', 'old-mod', 'old.txt'), 'old-content', 'utf8');
		});
		it('collects production npm dependencies if package config includes the dependencies object', done => {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'uuid'))).toBeTruthy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'minimist'))).toBeFalsy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'old-mod'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('uses the local .npmrc file if it exists', done => {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				optionalDependencies: {
					'minimist': '^1.2.0'
				}
			});
			fs.writeFileSync(path.join(sourcedir, '.npmrc'), 'optional = false', 'utf8');
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'uuid'))).toBeTruthy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'minimist'))).toBeFalsy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'old-mod'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('passes additional options to NPM if requested', done => {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				optionalDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir, workingdir, {'npm-options': '--no-optional'})
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'uuid'))).toBeTruthy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'minimist'))).toBeFalsy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'old-mod'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('uses local node_modules instead of running npm install if localDependencies is set to true', done => {
			configurePackage({
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir, workingdir, {'use-local-dependencies': true})
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'uuid'))).toBeFalsy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'old-mod'))).toBeTruthy();
				done();
			}, done.fail);
		});
		it('uses local node_modules when localDependencies is set to true, even when only specific files are requested', done => {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir, workingdir, {'use-local-dependencies': true})
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'uuid'))).toBeFalsy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'old-mod'))).toBeTruthy();
				done();
			}, done.fail);
		});
		it('includes versions from package-lock.json if it exists', done => {
			const lockContents = JSON.stringify({
				'name': 't',
				'version': '1.0.0',
				'lockfileVersion': 1,
				'requires': true,
				'dependencies': {
					'claudia-api-builder': {
						'version': '3.0.1',
						'resolved': 'https://registry.npmjs.org/claudia-api-builder/-/claudia-api-builder-3.0.1.tgz',
						'integrity': 'sha1-is7sm9KWWujA5amqIhZwWnNJ4Z4='
					}
				}
			});
			fs.writeFileSync(path.join(sourcedir, 'package-lock.json'), lockContents, 'utf8');
			configurePackage({ files: ['roo*'], dependencies: {'claudia-api-builder': '^3'} });
			underTest(sourcedir, workingdir)
			.then(packagedir => fs.readFileSync(path.join(packagedir, 'package-lock.json'), 'utf8'))
			.then(contents => expect(JSON.parse(contents).dependencies['claudia-api-builder'].version).toEqual('3.0.1'))
			.then(done, done.fail);
		});
		it('fails if npm install fails', done => {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'non-existing-package': '2.0.0'
				}
			});
			underTest(sourcedir, workingdir)
			.then(done.fail, reason => {
				expect(reason).toMatch(/npm install -q --no-audit --production failed/);
				done();
			});
		});
		it('does not change the current working dir', done => {
			configurePackage({ files: ['roo*', 'subdir'] });
			underTest(sourcedir, workingdir)
			.then(() => {
				expect(process.cwd()).toEqual(pwd);
				done();
			}, done.fail);
		});
		it('does not change the current working dir even if npm install fails', done => {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'non-existing-package': '2.0.0'
				}
			});
			underTest(sourcedir, workingdir)
			.then(done.fail, () => {
				expect(process.cwd()).toEqual(pwd);
				done();
			});
		});
	});
	describe('relative file dependencies', () => {
		it('installs relative dir dependencies', done => {
			setupDep('prod-dep');
			setupDep('dev-dep');
			setupDep('opt-dep');
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep'
				},
				devDependencies: {
					'dev-dep': 'file:../dev-dep'
				},
				optionalDependencies: {
					'opt-dep': 'file:../opt-dep'
				}
			});
			underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'prod-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(!fsUtil.isLink(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'opt-dep', 'opt-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeTruthy();
					expect(!fsUtil.isLink(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'dev-dep'))).toBeFalsy();
				})
				.then(done, done.fail);
		});
		it('supports direct paths without file:', done => {
			setupDep('prod-dep');
			setupDep('dev-dep');
			setupDep('opt-dep');
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': '../prod-dep'
				},
				devDependencies: {
					'dev-dep': path.resolve(workingdir, 'dev-dep')
				},
				optionalDependencies: {
					'opt-dep': path.resolve(workingdir, 'opt-dep')
				}
			});
			underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'prod-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(fsUtil.isLink(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeFalsy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'opt-dep', 'opt-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeTruthy();
					expect(fsUtil.isLink(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeFalsy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'dev-dep'))).toBeFalsy();
				})
				.then(done, done.fail);
		});

		it('remaps optional and production relative dependencies in package.json', done => {
			setupDep('prod-dep');
			setupDep('dev-dep');
			setupDep('opt-dep');
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep'
				},
				devDependencies: {
					'dev-dep': 'file:../dev-dep'
				},
				optionalDependencies: {
					'opt-dep': 'file:../opt-dep'
				}
			});
			underTest(sourcedir, workingdir)
			.then(packagePath => readjson(path.join(packagePath, 'package.json')))
			.then(packageConf => {
				expect(path.basename(packageConf.dependencies['prod-dep'])).toEqual('prod-dep-1.0.0.tgz');
				expect(path.basename(packageConf.optionalDependencies['opt-dep'])).toEqual('opt-dep-1.0.0.tgz');
				expect(packageConf.devDependencies).toBeFalsy();
			})
			.then(done, done.fail);

		});

		it('remaps file links to absolute paths', done => {
			let tgzPath, relativePath;
			setupDep('prod-dep');
			packProjectToTar(path.join(workingdir, 'prod-dep'), workingdir, [], nullLogger)
			.then(archivePath => tgzPath = archivePath)
			.then(() => {
				relativePath = path.relative(sourcedir, tgzPath);
				configurePackage({
					files: ['root.txt'],
					dependencies: {
						'prod-dep': 'file:' + relativePath
					}
				});
			})
			.then(() => underTest(sourcedir, workingdir))
			.then(packagePath => readjson(path.join(packagePath, 'package.json')))
			.then(packageConf => {
				expect(packageConf.dependencies['prod-dep']).toEqual('file:' + tgzPath);
				expect(packageConf.dependencies['prod-dep']).not.toEqual('file:' + relativePath);
			})
			.then(done, done.fail);

		});
		it('removes package lock if relative dependencies are used', done => {
			const lock = {
				'name': 'testproj',
				'version': '1.0.0',
				'lockfileVersion': 1,
				'requires': true,
				'dependencies': {
					'dev-dep': {
						'version': 'file:../dev-dep',
						'dev': true
					},
					'opt-dep': {
						'version': 'file:../opt-dep',
						'optional': true
					},
					'prod-dep': {
						'version': 'file:../prod-dep'
					}
				}
			};
			setupDep('prod-dep');
			setupDep('dev-dep');
			setupDep('opt-dep');
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep'
				},
				devDependencies: {
					'dev-dep': 'file:../dev-dep'
				},
				optionalDependencies: {
					'opt-dep': 'file:../opt-dep'
				}
			});
			fsPromise.writeFileAsync(path.join(sourcedir, 'package-lock.json'), JSON.stringify(lock), 'utf8')
			.then(() => underTest(sourcedir, workingdir))
			.then(() => {
				expect(fsUtil.isFile(path.join(workingdir, 'package-lock.json'))).toBeFalsy();
			})
			.then(done, done.fail);

		});
		it('works with relative file dependencies after installation', done => {
			setupDep('prod-dep');
			setupDep('dev-dep');
			setupDep('opt-dep');
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep'
				},
				devDependencies: {
					'dev-dep': 'file:../dev-dep'
				},
				optionalDependencies: {
					'opt-dep': 'file:../opt-dep'
				}
			});
			runNpm(sourcedir, 'install', nullLogger, true)
				.then(() => underTest(sourcedir, workingdir))
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'prod-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(!fsUtil.isLink(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'opt-dep', 'opt-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeTruthy();
					expect(!fsUtil.isLink(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'dev-dep'))).toBeFalsy();
				})
				.then(done, done.fail);

		});
		it('works with relative file dependencies after shrinkwrapping', done => {
			setupDep('prod-dep');
			setupDep('dev-dep');
			setupDep('opt-dep');
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep'
				},
				devDependencies: {
					'dev-dep': 'file:../dev-dep'
				},
				optionalDependencies: {
					'opt-dep': 'file:../opt-dep'
				}

			});
			runNpm(sourcedir, 'install', nullLogger, true)
				.then(() => runNpm(sourcedir, 'shrinkwrap', nullLogger, true))
				.then(() => underTest(sourcedir, workingdir))
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'prod-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(!fsUtil.isLink(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'opt-dep', 'opt-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeTruthy();
					expect(!fsUtil.isLink(path.join(packagePath, 'node_modules', 'opt-dep'))).toBeTruthy();
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'dev-dep'))).toBeFalsy();
				})
				.then(done, done.fail);

		});

		it('works with transitive relative file dependencies', done => {
			setupDep('trans-dep');
			setupDep('prod-dep', {'trans-dep': 'file:../trans-dep'});
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep'
				}
			});
			underTest(sourcedir, workingdir)
				.then(packagePath => {
					expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'prod-dep.js'))).toBeTruthy();
					expect(fsUtil.isDir(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(!fsUtil.isLink(path.join(packagePath, 'node_modules', 'prod-dep'))).toBeTruthy();
					expect(
						fsUtil.fileExists(path.join(packagePath, 'node_modules', 'trans-dep', 'trans-dep.js')) || /* npm3 */
						fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'node_modules', 'trans-dep', 'trans-dep.js')) /*npm5+*/
					).toBeTruthy();
				})
				.then(done, done.fail);
		});
		it('resolves the same relative dependency dir to the same file to enable deduping', done => {
			setupDep('trans-dep');
			setupDep('prod-dep', {'trans-dep': 'file:../trans-dep'});
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep',
					'trans-dep': 'file:../trans-dep'
				}
			});
			underTest(sourcedir, workingdir)
			.then(packagePath => Promise.all([readjson(path.join(packagePath, 'package.json')), readjson(path.join(packagePath, 'node_modules', 'prod-dep', 'package.json'))]))
			.then(packageConfArray => {
				const mainConf = packageConfArray[0],
					depConf = packageConfArray[1];
				expect(mainConf.dependencies['trans-dep']).toEqual(depConf.dependencies['trans-dep']);
			})
			.then(done, done.fail);
		});
		it('does not keep devDependencies of relative file dependencies', done => {

			setupDep('dev-dep');
			setupDep('prod-dep', {}, {'dev-dep': 'file:../dev-dep'});
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'prod-dep': 'file:../prod-dep'
				}
			});
			runNpm(path.join(workingdir, 'prod-dep'), 'install', nullLogger, true)
			.then(() => underTest(sourcedir, workingdir))
			.then(packagePath => {
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'prod-dep.js'))).toBeTruthy();
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'dev-dep'))).toBeFalsy(); /* npm3 */
				expect(fsUtil.fileExists(path.join(packagePath, 'node_modules', 'prod-dep', 'node_modules', 'dev-dep'))).toBeFalsy(); /*npm5+*/
			})
			.then(done, done.fail);
		});

	});
	it('works with scoped packages', done => {
		configurePackage({ name: '@test/packname' });
		underTest(sourcedir, workingdir)
		.then(packagePath => {
			expect(isSubDir(path.dirname(packagePath), workingdir)).toBeTruthy();
			expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
			expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
			expect(fs.readFileSync(path.join(packagePath, 'excluded.txt'), 'utf8')).toEqual('excl1');
		})
		.then(done, done.fail);
	});
	it('works with folders containing a space', done => {
		const oldsource = sourcedir;
		sourcedir = `${oldsource} with space`;
		fsUtil.move(oldsource, sourcedir);
		configurePackage({ name: 'test123' });
		underTest(sourcedir, workingdir)
		.then(packagePath => {
			expect(isSubDir(path.dirname(packagePath), workingdir)).toBeTruthy();
			expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
			expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
			expect(fs.readFileSync(path.join(packagePath, 'excluded.txt'), 'utf8')).toEqual('excl1');
			sourcedir = oldsource;
		})
		.then(done, done.fail);
	});
	it('logs progress', done => {
		const logger = new ArrayLogger();
		configurePackage({
			files: ['root.txt'],
			dependencies: {
				'uuid': '^2.0.0'
			}
		});
		underTest(sourcedir, workingdir, {}, logger)
		.then(() => {
			expect(logger.getCombinedLog()).toEqual([
				['stage', 'packaging files'],
				['call', `npm pack -q ${sourcedir}`],
				['call', 'npm install -q --no-audit --production']
			]);
		})
		.then(done, done.fail);
	});
});
