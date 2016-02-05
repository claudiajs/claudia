/*global describe, it, beforeEach, afterEach, require, it, expect */
var underTest = require('../src/tasks/collect-files'),
	shell = require('shelljs'),
	os = require('os'),
	fs = require('fs'),
	tmppath = require('../src/util/tmppath'),
	path = require('path');
describe('collectFiles', function () {
	'use strict';
	var destdir, sourcedir, pwd;
	beforeEach(function () {
		sourcedir = tmppath();
		shell.mkdir(sourcedir);


		fs.writeFileSync(path.join(sourcedir, 'root.txt'), 'text1', 'utf8');
		fs.writeFileSync(path.join(sourcedir, 'package.json'), '{}', 'utf8');
		fs.writeFileSync(path.join(sourcedir, 'excluded.txt'), 'excl1', 'utf8');
		shell.mkdir(path.join(sourcedir, 'subdir'));
		fs.writeFileSync(path.join(sourcedir, 'subdir', 'sub.txt'), 'text2', 'utf8');

		pwd = shell.pwd();
		shell.cd(sourcedir);
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
	it('fails if config.package does not contain the files property', function (done) {
		underTest({package: {}}).then(done.fail, function (message) {
			expect(message).toEqual('package.json does not contain the files property');
			done();
		});
	});
	it('copies all the listed files/subfolders/with wildcards from the files property to a folder in temp path', function (done) {
		underTest({package: {files: ['roo*', 'subdir']}}).then(function (packagePath) {
			destdir = packagePath;
			expect(path.dirname(packagePath)).toEqual(os.tmpdir());
			expect(fs.readFileSync(path.join(packagePath, 'root.txt'), 'utf8')).toEqual('text1');
			expect(fs.readFileSync(path.join(packagePath, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
			done();
		}, done.fail);
	});
	it('includes package.json even if it is not in the files property', function (done) {
		underTest({package: {files: ['roo*']}}).then(function (packagePath) {
			destdir = packagePath;
			expect(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8')).toEqual('{}');
			done();
		}, done.fail);
	});
	it('does not include any other files', function (done) {
		underTest({package: {files: ['roo*']}}).then(function (packagePath) {
			destdir = packagePath;
			expect(shell.test('-e', path.join(packagePath, 'excluded.txt'))).toBeFalsy();
			expect(shell.test('-e', path.join(packagePath, 'subdir'))).toBeFalsy();
			done();
		}, done.fail);
	});
	it('collects production npm dependencies if package config includes the dependencies flag', function (done) {
		var config = {
			package: {
				files: ['root.txt'],
				dependencies: {
					'uuid': '^2.0.0'
				},
				devDependencies: {
					'minimist': '^1.2.0'
				}
			}
		};
		fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify(config.package), 'utf8');
		underTest(config).then(function (packagePath) {
			destdir = packagePath;
			expect(shell.test('-e', path.join(packagePath, 'node_modules', 'uuid'))).toBeTruthy();
			expect(shell.test('-e', path.join(packagePath, 'node_modules', 'minimist'))).toBeFalsy();
			done();
		}, done.fail);

	});
	it('fails if npm install fails', function (done) {
		var config = {
			package: {
				files: ['root.txt'],
				dependencies: {
					'non-existing-package': '2.0.0'
				}
			}
		};
		fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify(config.package), 'utf8');
		underTest(config).then(done.fail, function (reason) {
			expect(reason).toEqual('npm install --production failed');
			done();
		});

	});

});
