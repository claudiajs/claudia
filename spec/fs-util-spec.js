/*global describe, it, expect, require, beforeEach, afterEach */
var tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	path = require('path'),
	shell = require('shelljs'),
	fsUtil = require('../src/util/fs-util');
describe('fsUtil', function () {
	'use strict';
	var pathName;
	beforeEach(function () {
		pathName = tmppath();
	});
	afterEach(function () {
		shell.rm('-rf', pathName);
	});
	describe('rmDir', function () {
		it('silently ignores empty directories', function () {
			expect(function () {
				fsUtil.rmDir(pathName);
			}).not.toThrowError();
		});
		it('removes an existing directory recursively', function () {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'subdir'));
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'subdir', 'subfile.txt'), '123', 'utf8');
			fsUtil.rmDir(pathName);
			expect(function () {
				fs.accessSync(pathName);
			}).toThrowError(/ENOENT: no such file or directory/);
		});
	});
	describe('ensureCleanDir', function () {
		it('creates an empty dir if it did not exist', function () {
			fsUtil.ensureCleanDir(pathName);
			expect(fs.readdirSync(pathName)).toEqual([]);
		});
		it('cleans up an existing directory', function () {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'subdir'));
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'subdir', 'subfile.txt'), '123', 'utf8');
			fsUtil.ensureCleanDir(pathName);
			expect(fs.readdirSync(pathName)).toEqual([]);
		});
	});
	describe('fileExists', function () {
		it('returns true for an existing file', function () {
			fs.writeFileSync(pathName, '123', 'utf8');
			expect(fsUtil.fileExists(pathName)).toBeTruthy();
		});
		it('returns false for a non-existing file', function () {
			expect(fsUtil.fileExists(pathName)).toBeFalsy();
		});
	});
});
