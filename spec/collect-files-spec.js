/*global describe, it, beforeEach, afterEach, require, it, expect */
var underTest = require('../src/tasks/collect-files'),
	shell = require('shelljs'),
	os = require('os'),
	fs = require('fs'),
	ArrayLogger = require('../src/util/array-logger'),
	tmppath = require('../src/util/tmppath'),
	path = require('path');
describe('collectFiles', function () {
	'use strict';
	var destdir, sourcedir, pwd,
		configurePackage = function (packageConf) {
			packageConf.name = packageConf.name  || 'testproj';
			packageConf.version = packageConf.version  || '1.0.0';
			fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify(packageConf), 'utf8');
		},
		isSameDir = function (dir1, dir2) {
			return !path.relative(dir1, dir2);
		};
	beforeEach(function () {
		sourcedir = tmppath();
		shell.mkdir(sourcedir);
		fs.writeFileSync(path.join(sourcedir, 'root.txt'), 'text1', 'utf8');
		fs.writeFileSync(path.join(sourcedir, 'excluded.txt'), 'excl1', 'utf8');
		shell.mkdir(path.join(sourcedir, 'subdir'));
		fs.writeFileSync(path.join(sourcedir, 'subdir', 'sub.txt'), 'text2', 'utf8');
		pwd = shell.pwd();
	});
	afterEach(function () {
		shell.cd(pwd);
		if (destdir) {
			shell.rm('-rf', destdir);
		}
		if (sourcedir) {
			shell.rm('-rf', sourcedir);
		}
	});
	it('fails if the source directory is not provided', function (done) {
		underTest().then(done.fail, function (message) {
			expect(message).toEqual('source directory not provided');
			done();
		});
	});
	it('fails if the source directory does not exist', function (done) {
		underTest(tmppath()).then(done.fail, function (message) {
			expect(message).toEqual('source directory does not exist');
			done();
		});
	});
	it('fails if the source directory is not a directory', function (done) {
		var filePath = path.join(sourcedir, 'file.txt');
		fs.writeFileSync(filePath, '{}', 'utf8');
		underTest(filePath).then(done.fail, function (message) {
			expect(message).toEqual('source path must be a directory');
			done();
		});
	});
	it('fails if package.json does not exist in the source directory', function (done) {
		underTest(sourcedir).then(done.fail, function (message) {
			expect(message).toEqual('source directory does not contain package.json');
			done();
		});
	});
	describe('when the files property is specified', function () {
		it('it limits the files copied to the files property', function (done) {
			configurePackage({files: ['roo*']});
			underTest(sourcedir).then(function (packagePath) {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('works when files is a single string', function (done) {
			configurePackage({files: ['root.txt']});
			underTest(sourcedir).then(function (packagePath) {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('copies all the listed files/subfolders/with wildcards from the files property to a folder in temp path', function (done) {
			configurePackage({files: ['roo*', 'subdir']});
			underTest(sourcedir).then(function (packagePath) {
				destdir = packagePath;
				expect(isSameDir(path.dirname(packagePath), os.tmpdir())).toBeTruthy();
				expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
				expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
				done();
			}, done.fail);
		});
		it('includes package.json even if it is not in the files property', function (done) {
			configurePackage({files: ['roo*']});
			underTest(sourcedir).then(function (packagePath) {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'package.json'))).toBeTruthy();
				done();
			}, done.fail);
		});
		['.gitignore', '.npmignore'].forEach(function (fileName) {
			it('ignores ' + fileName, function (done) {
				fs.writeFileSync(path.join(sourcedir, fileName), 'root.txt', 'utf8');
				configurePackage({files: ['roo*']});
				underTest(sourcedir).then(function (packagePath) {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				}).then(done, done.fail);
			});
		});
	});
	describe('when the files property is not specified', function () {
		it('copies all the project files to a folder in temp path', function (done) {
			configurePackage({});
			underTest(sourcedir).then(function (packagePath) {
				destdir = packagePath;
				expect(isSameDir(path.dirname(packagePath), os.tmpdir())).toBeTruthy();
				expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
				expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
				expect(fs.readFileSync(path.join(packagePath, 'excluded.txt'), 'utf8')).toEqual('excl1');
			}).then(done, done.fail);
		});
		it('includes package.json even if it is not in the files property', function (done) {
			configurePackage({});
			underTest(sourcedir).then(function (packagePath) {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'package.json'))).toBeTruthy();
			}).then(done, done.fail);
		});
		['node_modules', '.git', '.hg', '.svn', 'CVS'].forEach(function (dirName) {
			it('excludes ' + dirName + ' directory from the package', function (done) {
				shell.mkdir(path.join(sourcedir, dirName));
				fs.writeFileSync(path.join(sourcedir, dirName, 'sub.txt'), 'text2', 'utf8');

				configurePackage({});
				underTest(sourcedir).then(function (packagePath) {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, dirName, 'sub.txt'))).toBeFalsy();
				}).then(done, done.fail);

			});
		});
		['.gitignore', '.somename.swp', '._somefile', '.DS_Store', '.npmrc', 'npm-debug.log', 'config.gypi'].forEach(function (fileName) {
			it('excludes ' + fileName + ' file from the package', function (done) {
				fs.writeFileSync(path.join(sourcedir, fileName), 'text2', 'utf8');
				configurePackage({});
				underTest(sourcedir).then(function (packagePath) {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, fileName))).toBeFalsy();
				}).then(done, done.fail);

			});
		});
		['.gitignore', '.npmignore'].forEach(function (fileName) {
			it('ignores the wildcard contents specified in ' + fileName, function (done) {
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir', 'utf8');
				configurePackage({});
				underTest(sourcedir).then(function (packagePath) {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				}).then(done, done.fail);
			});
			it('ignores node_modules even when a separate ignore is specified in ' + fileName, function (done) {
				shell.mkdir(path.join(sourcedir, 'node_modules'));
				fs.writeFileSync(path.join(sourcedir, 'node_modules', 'sub.txt'), 'text2', 'utf8');
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir', 'utf8');
				configurePackage({});
				underTest(sourcedir).then(function (packagePath) {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'node_modules', 'sub.txt'))).toBeFalsy();
				}).then(done, done.fail);
			});
			it('survives blank and comment lines in ignore file lists for ' + fileName, function (done) {
				fs.writeFileSync(path.join(sourcedir, fileName), 'excl*\nsubdir\n\n#root.txt', 'utf8');
				configurePackage({});
				underTest(sourcedir).then(function (packagePath) {
					destdir = packagePath;
					expect(shell.test('-e', path.join(packagePath, 'root.txt'))).toBeTruthy();
					expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
					expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
				}).then(done, done.fail);

			});
		});
	});
	describe('collecting dependencies', function () {
		beforeEach(function () {
			shell.mkdir(path.join(sourcedir, 'node_modules'));
			shell.mkdir('-p', path.join(sourcedir, 'node_modules', 'old-mod'));
			fs.writeFileSync(path.join(sourcedir, 'node_modules', 'old-mod', 'old.txt'), 'old-content', 'utf8');
		});
		it('collects production npm dependencies if package config includes the dependencies object', function (done) {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir).then(function (packagePath) {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeTruthy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'minimist'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'old-mod'))).toBeFalsy();
				done();
			}, done.fail);
		});
		it('uses local node_modules instead of running npm install if localDependencies is set to true', function (done) {
			configurePackage({
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir, true).then(function (packagePath) {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'old-mod'))).toBeTruthy();
				done();
			}, done.fail);
		});
		it('uses local node_modules when localDependencie is set to true, even when only specific files are requested', function (done) {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			});
			underTest(sourcedir, true).then(function (packagePath) {
				destdir = packagePath;
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeFalsy();
				expect(shell.test('-e', path.join(packagePath, 'node_modules', 'old-mod'))).toBeTruthy();
				done();
			}, done.fail);
		});

		it('fails if npm install fails', function (done) {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'non-existing-package': '2.0.0'
				}
			});
			underTest(sourcedir).then(done.fail, function (reason) {
				expect(reason).toMatch(/^npm install --production failed/);
				done();
			});
		});
		it('does not change the current working dir', function (done) {
			configurePackage({files: ['roo*', 'subdir']});
			underTest(sourcedir).then(function () {
				expect(shell.pwd()).toEqual(pwd);
				done();
			}, done.fail);
		});
		it('does not change the current working dir even if npm install fails', function (done) {
			configurePackage({
				files: ['root.txt'],
				dependencies: {
					'non-existing-package': '2.0.0'
				}
			});
			underTest(sourcedir).then(done.fail, function () {
				expect(shell.pwd()).toEqual(pwd);
				done();
			});
		});
	});

	it('logs progress', function (done) {
		var logger = new ArrayLogger();
		configurePackage({
			files: ['root.txt'],
			dependencies: {
				'uuid': '^2.0.0'
			}
		});
		underTest(sourcedir, false, logger).then(function () {
			expect(logger.getCombinedLog()).toEqual([
				['stage', 'packaging files'],
				['call', 'npm pack ' + sourcedir],
				['call', 'npm install --production']
			]);
		}).then(done, done.fail);
	});
});
