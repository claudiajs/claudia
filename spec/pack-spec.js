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
			process.chdir(workingdir);
		})
		.then(done, done.fail);
	});
	afterEach(() => {
		process.chdir(pwd);
		fsUtil.rmDir(workingdir);
	});
	it('fails if the source folder is same as os tmp folder', done => {
		underTest({source: os.tmpdir()}, logger)
			.then(done.fail, message => expect(message).toEqual('Source directory is the Node temp directory. Cowardly refusing to fill up disk with recursive copy.'))
			.then(done);
	});
	it('fails if local dependencies and optional dependencies are mixed', done => {
		underTest({'use-local-dependencies': true, 'optional-dependencies': false}, logger)
		.then(done.fail, message => expect(message).toEqual('incompatible arguments --use-local-dependencies and --no-optional-dependencies'))
		.then(done);
	});
	it('fails if the source directory is not a node project', done => {
		underTest({source: workingdir}, logger)
		.then(done.fail, message => expect(message).toEqual('package.json does not exist in the source folder'))
		.then(done);
	});
	it('fails if the default output file already exists', done => {
		const archivePath = path.join(workingdir, 'optional-dependencies', 'echo-1.0.0.zip');
		process.chdir(path.join(workingdir, 'optional-dependencies'));
		fs.writeFileSync(archivePath, 'exists', 'utf8');
		underTest({}, logger)
		.then(done.fail, message => expect(message).toMatch(/echo-1\.0\.0\.zip already exists\. Use --force to overwrite it\.$/))
		.then(() => expect(fs.readFileSync(archivePath, 'utf8')).toEqual('exists'))
		.then(done);
	});
	it('fails if the specified output file already exists', done => {
		const archivePath = path.join(workingdir, 'echo.zip');
		fs.writeFileSync(archivePath, 'exists', 'utf8');
		underTest({source: path.join(workingdir, 'optional-dependencies'), output: archivePath}, logger)
		.then(done.fail, message => expect(message).toMatch(/echo\.zip already exists. Use --force to overwrite it\.$/))
		.then(() => expect(fs.readFileSync(archivePath, 'utf8')).toEqual('exists'))
		.then(done);
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
	it('overwrites an existing file if force is set', done => {
		process.chdir(path.join(workingdir, 'optional-dependencies'));
		fs.writeFileSync('xx.zip', 'exists', 'utf8');
		underTest({output: 'xx.zip', force: true, 'optional-dependencies': false}, logger)
		.then(result => {
			expect(path.basename(result.output)).toEqual('xx.zip');
			expect(path.basename(result.output)).toEqual('xx.zip');
			return decompress(result.output, unpackPath);
		})
		.then(() => {
			expect(fsUtil.isFile(path.join(unpackPath, 'package.json'))).toBeTruthy();
			expect(fsUtil.isFile(path.join(unpackPath, 'main.js'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules'))).toBeTruthy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'aws-sdk'))).toBeFalsy();
			expect(fsUtil.isDir(path.join(unpackPath, 'node_modules', 'huh'))).toBeTruthy();
		})
		.then(done, done.fail);
	});

});
