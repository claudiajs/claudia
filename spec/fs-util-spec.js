/*global describe, it, expect, require, beforeEach, afterEach, process */
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
		it('creates the parent hierarchy as well', function () {
			fsUtil.ensureCleanDir(pathName + '/sub/dir');
			expect(fs.readdirSync(pathName)).toEqual(['sub']);
			expect(fs.readdirSync(path.join(pathName, 'sub'))).toEqual(['dir']);
			expect(fs.readdirSync(path.join(pathName, 'sub', 'dir'))).toEqual([]);
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
	describe('isDir', function () {
		it('is false for non-existing paths', function () {
			expect(fsUtil.isDir(pathName)).toBeFalsy();
		});
		it('is false for files', function () {
			fs.writeFileSync(pathName, '123', 'utf8');
			expect(fsUtil.isDir(pathName)).toBeFalsy();
		});
		it('is true for directories', function () {
			fs.mkdirSync(pathName);
			expect(fsUtil.isDir(pathName)).toBeTruthy();
		});
	});
	describe('copy', function () {
		it('recursively copies a directory to another existing dir', function () {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'content'));
			fs.mkdirSync(path.join(pathName, 'copy'));
			fs.mkdirSync(path.join(pathName, 'content', 'subdir'));
			fs.writeFileSync(path.join(pathName, 'content', 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'content', 'subdir', 'subfile.txt'), '456', 'utf8');

			fsUtil.copy(path.join(pathName, 'content'), path.join(pathName, 'copy'));

			expect(fs.readFileSync(path.join(pathName, 'copy', 'content', 'subdir', 'subfile.txt'), 'utf8')).toEqual('456');
			expect(fs.readFileSync(path.join(pathName, 'copy', 'content', 'file.txt'), 'utf8')).toEqual('123');

			expect(fs.readFileSync(path.join(pathName, 'content', 'subdir', 'subfile.txt'), 'utf8')).toEqual('456');
			expect(fs.readFileSync(path.join(pathName, 'content', 'file.txt'), 'utf8')).toEqual('123');
		});
		it('copies a file to an existing dir', function () {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'copy'));
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');

			fsUtil.copy(path.join(pathName, 'file.txt'), path.join(pathName, 'copy'));

			expect(fs.readFileSync(path.join(pathName, 'copy', 'file.txt'), 'utf8')).toEqual('123');

			expect(fs.readFileSync(path.join(pathName, 'file.txt'), 'utf8')).toEqual('123');
		});
	});
	describe('recursiveList', function () {
		beforeEach(function () {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'content'));
			fs.mkdirSync(path.join(pathName, 'content', 'subdir'));
			fs.writeFileSync(path.join(pathName, 'content', 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'content', 'numbers.txt'), '331', 'utf8');
			fs.writeFileSync(path.join(pathName, 'content', 'subdir', 'subfile.txt'), '456', 'utf8');

			fs.mkdirSync(path.join(pathName, 'empty'));
		});

		describe('with absolute paths', function () {
			it('lists contents of a directory recursively', function () {
				expect(fsUtil.recursiveList(path.join(pathName, 'content')).sort()).toEqual(
						['file.txt', 'numbers.txt', 'subdir', 'subdir/subfile.txt']
				);
			});
			it('uses globbing patterns', function () {
				expect(fsUtil.recursiveList(path.join(pathName, 'content', '*.txt')).sort()).toEqual([
					path.join(pathName, 'content', 'file.txt'),
					path.join(pathName, 'content', 'numbers.txt')
				]);
			});
			it('lists a single file', function () {
				expect(fsUtil.recursiveList(path.join(pathName, 'content', 'file.txt'))).toEqual([path.join(pathName, 'content', 'file.txt')]);
				expect(fsUtil.recursiveList(path.join(pathName, 'content', 'file*'))).toEqual([path.join(pathName, 'content', 'file.txt')]);
			});
			it('returns an empty array if no matching files', function () {
				expect(fsUtil.recursiveList(path.join(pathName, 'nx'))).toEqual([]);
			});
			it('returns an empty array if directory is empty', function () {
				expect(fsUtil.recursiveList(path.join(pathName, 'empty'))).toEqual([]);
			});
		});
		describe('with relative paths', function () {
			var cwd;
			beforeEach(function () {
				cwd = process.cwd();
				process.chdir(pathName);
			});
			afterEach(function () {
				process.chdir(cwd);
			});
			it('lists contents of a directory recursively', function () {
				expect(fsUtil.recursiveList('content').sort()).toEqual(
						['file.txt', 'numbers.txt', 'subdir', 'subdir/subfile.txt']
				);
			});
			it('uses globbing patterns', function () {
				expect(fsUtil.recursiveList('content/*.txt').sort()).toEqual([
					path.join('content', 'file.txt'),
					path.join('content', 'numbers.txt')
				]);
			});
			it('lists a single file', function () {
				expect(fsUtil.recursiveList(path.join('content', 'file.txt'))).toEqual([path.join('content', 'file.txt')]);
				expect(fsUtil.recursiveList(path.join('content', 'file*'))).toEqual([path.join('content', 'file.txt')]);
			});
			it('returns an empty array if no matching files', function () {
				expect(fsUtil.recursiveList('nx')).toEqual([]);
			});
			it('returns an empty array if directory is empty', function () {
				expect(fsUtil.recursiveList('empty')).toEqual([]);
			});
		});
	});
	describe('isFile', function () {
		it('is false for non-existing paths', function () {
			expect(fsUtil.isFile(pathName)).toBeFalsy();
		});
		it('is true for files', function () {
			fs.writeFileSync(pathName, '123', 'utf8');
			expect(fsUtil.isFile(pathName)).toBeTruthy();
		});
		it('is false for directories', function () {
			fs.mkdirSync(pathName);
			expect(fsUtil.isFile(pathName)).toBeFalsy();
		});
	});
});
