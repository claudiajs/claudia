/*global describe, it, beforeEach, afterEach, expect, process */
const underTest = require('../src/tasks/collect-files'),
	shell = require('shelljs'),
	os = require('os'),
	fs = require('fs'),
	ArrayLogger = require('../src/util/array-logger'),
	tmppath = require('../src/util/tmppath'),
	fsPromise = require('../src/util/fs-promise'),
	path = require('path');
describe('collectFiles', () => {
	'use strict';
	let destdir, sourcedir, workingdir, pwd;
	const configurePackage = function (packageConf) {
			packageConf.name = packageConf.name || 'testproj';
			packageConf.version = packageConf.version || '1.0.0';
			fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify(packageConf), 'utf8');
		},
		isSameDir = function (dir1, dir2) {
			return !path.relative(dir1, dir2);
		};
	beforeEach(done => {
		pwd = process.cwd();
		fsPromise.mkdtempAsync(os.tmpdir())
		.then(dir => {
			workingdir = dir;
			sourcedir = path.join(workingdir, 'source');
			shell.mkdir(sourcedir);
			fs.writeFileSync(path.join(sourcedir, 'root.txt'), 'text1', 'utf8');
			fs.writeFileSync(path.join(sourcedir, 'excluded.txt'), 'excl1', 'utf8');
			shell.mkdir(path.join(sourcedir, 'subdir'));
			fs.writeFileSync(path.join(sourcedir, 'subdir', 'sub.txt'), 'text2', 'utf8');
		})
		.then(done, done.fail);
	});
	afterEach(() => {
		shell.cd(pwd);
		if (destdir) {
			shell.rm('-rf', destdir);
		}
		if (sourcedir) {
			shell.rm('-rf', sourcedir);
		}
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
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('works when files is a single string', done => {
			configurePackage({ files: ['root.txt'] });
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('copies all the listed files/subfolders/with wildcards from the files property to a folder in temp path', done => {
			configurePackage({ files: ['roo*', 'subdir'] });
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				destdir = packagePath;
				expect(isSameDir(path.dirname(packagePath), os.tmpdir())).toBeTruthy();
				expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
				expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
				done();
			}, done.fail);
		});
		it('includes package.json even if it is not in the files property', done => {
			configurePackage({ files: ['roo*'] });
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'package.json'))).toBeTruthy();
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
			.then(packagePath => destdir = packagePath)
			.then(() => fs.readFileSync(path.join(destdir, 'package-lock.json'), 'utf8'))
			.then(contents => expect(JSON.parse(contents).dependencies['claudia-api-builder'].version).toEqual('3.0.1'))
			.then(done, done.fail);
		});

		['.gitignore', '.npmignore'].forEach(fileName => {
			it(`ignores ${fileName}`, done => {
				fs.writeFileSync(path.join(sourcedir, fileName), 'root.txt', 'utf8');
				configurePackage({files: ['roo*']});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
		});
	});
	describe('when the files property is not specified', () => {
		it('copies all the project files to a folder in temp path', done => {
			configurePackage({});
			underTest(sourcedir, workingdir)
			.then(packagePath => {
				destdir = packagePath;
				expect(isSameDir(path.dirname(packagePath), os.tmpdir())).toBeTruthy();
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
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'package.json'))).toBeTruthy();
			})
			.then(done, done.fail);
		});
		['node_modules', '.git', '.hg', '.svn', 'CVS'].forEach(dirName => {
			it(`excludes ${dirName} directory from the package`, done => {
				shell.mkdir(path.join(sourcedir, dirName));
				fs.writeFileSync(path.join(sourcedir, dirName, 'sub.txt'), 'text2', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, dirName, 'sub.txt'))).toBeFalsy();
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
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, fileName))).toBeFalsy();
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
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, fileName))).toBeTruthy();
			})
			.then(done, done.fail);
		});
		['.gitignore', '.npmignore'].forEach(fileName => {
			it(`ignores the wildcard contents specified in ${fileName}`, done => {
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
			it(`ignores node_modules even when a separate ignore is specified in ${fileName}`, done => {
				shell.mkdir(path.join(sourcedir, 'node_modules'));
				fs.writeFileSync(path.join(sourcedir, 'node_modules', 'sub.txt'), 'text2', 'utf8');
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'node_modules', 'sub.txt'))).toBeFalsy();
				})
				.then(done, done.fail);
			});
			it(`survives blank and comment lines in ignore file lists for ${fileName}`, done => {
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir\n\n#root.txt', 'utf8');
				configurePackage({});
				underTest(sourcedir, workingdir)
				.then(packagePath => {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
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
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeTruthy();
			})
			.then(done, done.fail);
		});

	});
	describe('collecting dependencies', () => {
		beforeEach(() => {
			shell.mkdir(path.join(sourcedir, 'node_modules'));
			shell.mkdir('-p', path.join(sourcedir, 'node_modules', 'old-mod'));
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
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'minimist'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'old-mod'))).toBeFalsy();
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
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'minimist'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'old-mod'))).toBeFalsy();
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
			underTest(sourcedir, workingdir, true)
			.then(packagePath => {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'old-mod'))).toBeTruthy();
				done();
			}, done.fail);
		});
		it('uses local node_modules when localDependencie is set to true, even when only specific files are requested', done => {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir, workingdir, true)
			.then(packagePath => {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'old-mod'))).toBeTruthy();
				done();
			}, done.fail);
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
				expect(reason).toMatch(/npm install --production failed/);
				done();
			});
		});
		it('does not change the current working dir', done => {
			configurePackage({ files: ['roo*', 'subdir'] });
			underTest(sourcedir, workingdir)
			.then(() => {
				expect(shell.pwd()).toEqual(pwd);
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
				expect(shell.pwd()).toEqual(pwd);
				done();
			});
		});
	});
	it('works with scoped packages', done => {
		configurePackage({ name: '@test/packname' });
		underTest(sourcedir, workingdir)
		.then(packagePath => {
			destdir = packagePath;
			expect(isSameDir(path.dirname(packagePath), os.tmpdir())).toBeTruthy();
			expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
			expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
			expect(fs.readFileSync(path.join(packagePath, 'excluded.txt'), 'utf8')).toEqual('excl1');
		})
		.then(done, done.fail);
	});
	it('works with folders containing a space', done => {
		const oldsource = sourcedir;
		sourcedir = `${oldsource} with space`;
		shell.mv(oldsource, sourcedir);
		configurePackage({ name: 'test123' });
		underTest(sourcedir, workingdir)
		.then(packagePath => {
			destdir = packagePath;
			expect(isSameDir(path.dirname(packagePath), os.tmpdir())).toBeTruthy();
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
		underTest(sourcedir, workingdir, false, logger)
		.then(() => {
			expect(logger.getCombinedLog()).toEqual([
				['stage', 'packaging files'],
				['call', `npm pack "${sourcedir}"`],
				['call', 'npm install --production']
			]);
		})
		.then(done, done.fail);
	});
});
