/*global describe, it, beforeEach, afterEach, require, it, expect */
var underTest = require('../src/util/run-npm'),
	shell = require('shelljs'),
	fs = require('fs'),
	ArrayLogger = require('../src/util/array-logger'),
	tmppath = require('../src/util/tmppath'),
	path = require('path');
describe('runNpm', function () {
	'use strict';
	var sourcedir, pwd,
		logger,
		configurePackage = function (packageConf) {
			fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify(packageConf), 'utf8');
		};
	beforeEach(function () {
		sourcedir = tmppath();
		shell.mkdir(sourcedir);
		logger = new ArrayLogger();
		pwd = shell.pwd();
	});
	afterEach(function () {
		shell.cd(pwd);
		if (sourcedir) {
			shell.rm('-rf', sourcedir);
		}
	});
	it('executes NPM in a folder', function (done) {
		configurePackage({
			dependencies: {
				'uuid': '^2.0.0'
			},
			devDependencies: {
				'minimist': '^1.2.0'
			}
		});
		underTest(sourcedir, 'install --production', logger).then(function (packagePath) {
			expect(packagePath).toEqual(sourcedir);
			expect(shell.pwd()).toEqual(pwd);
			expect(shell.test('-e', path.join(sourcedir, 'node_modules', 'uuid'))).toBeTruthy();
			expect(shell.test('-e', path.join(sourcedir, 'node_modules', 'minimist'))).toBeFalsy();
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
		underTest(sourcedir, 'install --production', logger).then(done.fail, function (reason) {
			expect(reason).toMatch(/^npm install --production failed/);
			done();
		});
	});
});
