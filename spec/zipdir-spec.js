/*global describe, it, expect, beforeEach, afterEach, require */
const fs = require('fs'),
	os = require('os'),
	path = require('path'),
	tmppath = require('../src/util/tmppath'),
	fsUtil = require('../src/util/fs-util'),
	trimSlash = require('../src/util/trimslash'),
	childProcess = require('child_process'),
	underTest = require('../src/tasks/zipdir');

describe('zipdir', () => {
	'use strict';
	let workingdir, zipfile, pwd;
	beforeEach(() => {
		workingdir = tmppath();
		fs.mkdirSync(workingdir);
		pwd = process.cwd();
		zipfile = false;
	});
	afterEach(() => {
		process.chdir(pwd);
		fsUtil.silentRemove(workingdir);
		if (zipfile) {
			fsUtil.silentRemove(zipfile);
		}
	});
	it('rejects if the path does not exist', done => {
		const argpath = tmppath();
		underTest(argpath).then(done.fail, reason => {
			expect(reason).toEqual(argpath + ' does not exist');
			done();
		});
	});
	it('rejects if the path is not a dir', done => {
		const filePath = path.join(workingdir, 'root.txt');
		fs.writeFileSync(filePath, 'text1', 'utf8');
		underTest(filePath).then(done.fail, (reason) => {
			expect(reason).toEqual(filePath + ' is not a directory');
			done();
		});
	});
	it('zips up files and subfolders into a temporary path', done => {
		const original = path.join(workingdir, 'original'),
			unpacked = path.join(workingdir, 'unpacked');
		fs.mkdirSync(original);
		fs.writeFileSync(path.join(original, 'root.txt'), 'text1', 'utf8');
		fs.mkdirSync(path.join(original, 'subdir'));
		fs.writeFileSync(path.join(original, 'subdir', 'sub.txt'), 'text2', 'utf8');

		underTest(original).then(argpath => {
			zipfile = argpath;
			fs.mkdirSync(unpacked);
			return new Promise((resolve, reject) => {
				childProcess.execFile('unzip', [argpath], {cwd: unpacked, env: process.env}, (error) => {
					if (error) {
						return reject(error);
					}
					resolve();
				});
			});
		}).then(() => {
			expect(trimSlash(path.dirname(zipfile))).toEqual(trimSlash(os.tmpdir()));
			expect(fs.readFileSync(path.join(unpacked, 'root.txt'), 'utf8')).toEqual('text1');
			expect(fs.readFileSync(path.join(unpacked, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');
		}).then(done, done.fail);
	});
	it('removes the original dir if successful', done => {
		const original = path.join(workingdir, 'original');

		fs.mkdirSync(original);
		fs.writeFileSync(path.join(original, 'root.txt'), 'text1', 'utf8');
		underTest(original).then(() => {
			expect(fs.existsSync(original)).toBeFalsy();
		}).then(done, done.fail);
	});
});

