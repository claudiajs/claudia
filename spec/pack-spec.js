/*global describe, it, expect, beforeEach, afterEach*/
const underTest = require('../src/commands/pack'),
	os = require('os'),
	path = require('path'),
	fs = require('fs'),
	ArrayLogger = require('../src/util/array-logger'),
	fsPromise = require('../src/util/fs-promise'),
	decompress = require('decompress'),
	fsUtil = require('../src/util/fs-util');
describe('pack', () => {
	'use strict';
	let pwd, workingdir, logger, unpackPath;
	beforeEach(done => {
		pwd = process.cwd();
		logger = new ArrayLogger();
		fsPromise.mkdtempAsync(os.tmpdir() + path.sep)
		.then(dir => {
			workingdir = path.resolve(dir);
			fsUtil.copy(path.join(__dirname, 'test-projects', 'optional-dependencies'), workingdir);
			unpackPath = path.join(workingdir, 'unpack');
			fs.mkdirSync(unpackPath);
		})
		.then(done, done.fail);
	});
	afterEach(() => {
		process.chdir(pwd);
		fsUtil.rmDir(workingdir);
	});
	it('packs a project with all the production dependencies', done => {
		process.chdir(path.join(workingdir, 'optional-dependencies'));
		underTest({}, logger)
		.then(result => decompress(result.output, unpackPath))
		.then(() => {
			expect(fsUtil.isFile(path.join(unpackPath, 'package.json'))).toBeTruthy();
			expect(fsUtil.isFile(path.join(unpackPath, 'main.js'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'aws-sdk'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'huh'))).toBeTruthy();
		})
		.then(done, done.fail);
	});
	it('packs a project without optional dependencies if requested', done => {
		process.chdir(path.join(workingdir, 'optional-dependencies'));
		underTest({'optional-dependencies': false}, logger)
		.then(result => decompress(result.output, unpackPath))
		.then(() => {
			expect(fsUtil.isFile(path.join(unpackPath, 'package.json'))).toBeTruthy();
			expect(fsUtil.isFile(path.join(unpackPath, 'main.js'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'aws-sdk'))).toBeFalsy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'huh'))).toBeTruthy();
		})
		.then(done, done.fail);
	});
	it('packs a project from a source dir', done => {
		process.chdir(path.join(workingdir));
		underTest({'source': path.join(workingdir, 'optional-dependencies'), 'optional-dependencies': false}, logger)
		.then(result => decompress(result.output, unpackPath))
		.then(() => {
			expect(fsUtil.isFile(path.join(unpackPath, 'package.json'))).toBeTruthy();
			expect(fsUtil.isFile(path.join(unpackPath, 'main.js'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'aws-sdk'))).toBeFalsy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'huh'))).toBeTruthy();
		})
		.then(done, done.fail);
	});
	it('packs a local project to a default file name', done => {
		process.chdir(path.join(workingdir, 'optional-dependencies'));
		underTest({}, logger)
		.then(result => {
			expect(path.basename(result.output)).toEqual('echo-1.0.0.zip');
			expect(fsUtil.isFile(result.output)).toBeTruthy();
		})
		.then(done, done.fail);
	});
	it('uses the specified file name', done => {
		process.chdir(path.join(workingdir, 'optional-dependencies'));
		underTest({output: 'xx.zip'}, logger)
		.then(result => {
			expect(path.basename(result.output)).toEqual('xx.zip');
			expect(path.dirname(result.output)).toEqual(path.resolve(process.cwd()));
			expect(fsUtil.isFile(result.output)).toBeTruthy();
		})
		.then(done, done.fail);
	});
});
