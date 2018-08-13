/*global describe, it, expect, beforeEach, afterEach, require*/

const packProjectToTar = require('../src/util/pack-project-to-tar'),
	os = require('os'),
	fs = require('fs'),
	ArrayLogger = require('../src/util/array-logger'),
	fsPromise = require('../src/util/fs-promise'),
	fsUtil = require('../src/util/fs-util'),
	extractTar = require('../src/util/extract-tar'),
	path = require('path');
describe('packProjectToTar', () => {
	'use strict';
	let workingdir, sourcedir, unpackdir, logger;
	beforeEach(done => {
		logger = new ArrayLogger();
		fsPromise.mkdtempAsync(os.tmpdir() + path.sep)
		.then(dir => {
			workingdir = path.resolve(dir);
			sourcedir = path.join(workingdir, 'source');
			unpackdir = path.join(workingdir, 'unpack');
			fs.mkdirSync(sourcedir);
			fs.mkdirSync(unpackdir);

			fs.writeFileSync(path.join(sourcedir, 'root.txt'), 'text1', 'utf8');
			fs.writeFileSync(path.join(sourcedir, 'excluded.txt'), 'excl1', 'utf8');
			fs.mkdirSync(path.join(sourcedir, 'subdir'));
			fs.writeFileSync(path.join(sourcedir, 'subdir', 'sub.txt'), 'text2', 'utf8');
			fs.writeFileSync(path.join(sourcedir, 'package.json'), JSON.stringify({
				name: 'cool-package',
				version: '1.0.0',
				files: ['root.txt', 'subdir']
			}), 'utf8');
		})
		.then(done, done.fail);

	});
	afterEach(() => {
		fsUtil.rmDir(workingdir);
	});
	it('returns a path to a tar archive containing packed project files', done => {
		packProjectToTar(sourcedir, workingdir, [], logger)
		.then(archive => extractTar(archive, unpackdir))
		.then(() => {
			expect(fsUtil.fileExists(path.join(unpackdir, 'package', 'root.txt'))).toBeTruthy();
			expect(fsUtil.fileExists(path.join(unpackdir, 'package', 'excluded.txt'))).toBeFalsy();
			expect(fsUtil.isDir(path.join(unpackdir, 'package', 'subdir'))).toBeTruthy();
			expect(fsUtil.fileExists(path.join(unpackdir, 'package', 'subdir', 'sub.txt'))).toBeTruthy();
		})
		.then(done, done.fail);
	});
	it('creates the archive in a subdir of the working dir', done => {
		packProjectToTar(sourcedir, workingdir, [], logger)
		.then(archive => {
			expect(path.dirname(path.dirname(archive))).toEqual(workingdir);
		})
		.then(done, done.fail);
	});
	it('logs NPM commands', done => {
		packProjectToTar(sourcedir, workingdir, [], logger)
		.then(() => {
			expect(logger.getCombinedLog()).toEqual([
				['call', `npm pack -q ${sourcedir}`]
			]);
		})
		.then(done, done.fail);
	});
});
