/*global describe, it, beforeEach, afterEach, require, it, expect */
const underTest = require('../src/util/run-npm'),
	shell = require('shelljs'),
	fs = require('fs'),
	ArrayLogger = require('../src/util/array-logger'),
	tmppath = require('../src/util/tmppath'),
	path = require('path');

describe('runNpm', () => {
	'use strict';
	let sourcedir, pwd,
		logger;
	const configurePackage = function (packageConf) {
		fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify(packageConf), 'utf8');
	};

	beforeEach(() => {
		sourcedir = tmppath();
		shell.mkdir(sourcedir);
		logger = new ArrayLogger();
		pwd = shell.pwd();
	});
	afterEach(() => {
		shell.cd(pwd);
		if (sourcedir) {
			shell.rm('-rf', sourcedir);
		}
	});
	it('executes NPM in a folder', done => {
		configurePackage({
			dependencies: {
				'uuid': '^2.0.0'
			},
			devDependencies: {
				'minimist': '^1.2.0'
			}
		});
		underTest(sourcedir, 'install --production', logger).then(packagePath => {
			expect(packagePath).toEqual(sourcedir);
			expect(shell.pwd()).toEqual(pwd);
			expect(shell.test('-e', path.join(sourcedir, 'node_modules', 'uuid'))).toBeTruthy();
			expect(shell.test('-e', path.join(sourcedir, 'node_modules', 'minimist'))).toBeFalsy();
			done();
		}, done.fail);
	});
	it('uses local .npmrc if exists', done => {
		configurePackage({
			dependencies: {
				'uuid': '^2.0.0'
			},
			optionalDependencies: {
				'minimist': '^1.2.0'
			}
		});
		fs.writeFileSync(path.join(sourcedir, '.npmrc'), 'optional = false', 'utf8');
		underTest(sourcedir, 'install --production', logger).then(packagePath => {
			expect(packagePath).toEqual(sourcedir);
			expect(shell.pwd()).toEqual(pwd);
			expect(shell.test('-e', path.join(sourcedir, 'node_modules', 'uuid'))).toBeTruthy();
			expect(shell.test('-e', path.join(sourcedir, 'node_modules', 'minimist'))).toBeFalsy();
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
		underTest(sourcedir, 'install --production', logger).then(done.fail, reason => {
			expect(reason).toMatch(/npm install --production failed/);
			done();
		});
	});
});
