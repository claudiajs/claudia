/*global describe, it, expect, require, beforeEach, afterEach*/

const fsUtil = require('../src/util/fs-util'),
	fs = require('fs'),
	extractTar = require('../src/util/extract-tar'),
	fsPromise = require('../src/util/fs-promise'),
	os = require('os'),
	path = require('path');
describe('extractTar', () => {
	'use strict';
	let workingdir;
	beforeEach(done => {
		fsPromise.mkdtempAsync(os.tmpdir() + path.sep)
		.then(dir => {
			workingdir = path.resolve(dir);
		})
		.then(done, done.fail);
	});
	afterEach(() => {
		fsUtil.rmDir(workingdir);
	});
	it('unpacks an archive into a destination folder', done => {
		extractTar(path.join(__dirname, 'test-projects', 'tar-gz-example.tgz'), workingdir)
		.then(() => {
			expect(fs.readFileSync(path.join(workingdir, 'root.txt'), 'utf8')).toEqual('root\n');
			expect(fs.readFileSync(path.join(workingdir, 'subdir', 'sub.txt'), 'utf8')).toEqual('sub\n');
		})
		.then(done, done.fail);
	});
});

