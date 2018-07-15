/*global describe, it, beforeEach, afterEach, require, it, expect */
const underTest = require('../src/util/run-npm'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
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
		fs.mkdirSync(sourcedir);
		logger = new ArrayLogger();
		pwd = process.cwd();
	});
	afterEach(() => {
		process.chdir(pwd);
		if (sourcedir) {
			fsUtil.silentRemove(sourcedir);
		}
	});
	it('executes NPM in a folder with arguments as a string', done => {
		configurePackage({
			dependencies: {
				'uuid': '^2.0.0'
			},
			devDependencies: {
				'minimist': '^1.2.0'
			}
		});
		underTest(sourcedir, 'install -s --production', logger, true).then(packagePath => {
			expect(packagePath).toEqual(sourcedir);
			expect(process.cwd()).toEqual(pwd);
			expect(fs.existsSync(path.join(sourcedir, 'node_modules', 'uuid'))).toBeTruthy();
			expect(fs.existsSync(path.join(sourcedir, 'node_modules', 'minimist'))).toBeFalsy();
			done();
		}, done.fail);
	});
	it('executes NPM in a folder with arguments as an array', done => {
		configurePackage({
			dependencies: {
				'uuid': '^2.0.0'
			},
			devDependencies: {
				'minimist': '^1.2.0'
			}
		});
		underTest(sourcedir, ['install', '-s', '--production'], logger, true).then(packagePath => {
			expect(packagePath).toEqual(sourcedir);
			expect(process.cwd()).toEqual(pwd);
			expect(fs.existsSync(path.join(sourcedir, 'node_modules', 'uuid'))).toBeTruthy();
			expect(fs.existsSync(path.join(sourcedir, 'node_modules', 'minimist'))).toBeFalsy();
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
		underTest(sourcedir, 'install -s --production', logger, true).then(packagePath => {
			expect(packagePath).toEqual(sourcedir);
			expect(process.cwd()).toEqual(pwd);
			expect(fs.existsSync(path.join(sourcedir, 'node_modules', 'uuid'))).toBeTruthy();
			expect(fs.existsSync(path.join(sourcedir, 'node_modules', 'minimist'))).toBeFalsy();
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
		underTest(sourcedir, 'install -s --production', logger, true).then(done.fail, reason => {
			expect(reason).toMatch(/npm install -s --production failed/);
			done();
		});
	});
});
