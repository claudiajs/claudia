/*global describe, it, expect, beforeEach, afterEach */
const tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	fsExtra = require('fs-extra'),
	path = require('path'),
	fsUtil = require('../src/util/fs-util');
describe('fsUtil', () => {
	'use strict';
	let pathName;
	beforeEach(() => {
		pathName = tmppath();
	});
	afterEach(done => {
		fsExtra.remove(pathName)
		.then(done);
	});
	describe('rmDir', () => {
		it('silently ignores empty directories', () => {
			expect(() => fsUtil.rmDir(pathName)).not.toThrowError();
		});
		it('removes an existing directory recursively', () => {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'subdir'));
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'subdir', 'subfile.txt'), '123', 'utf8');
			fsUtil.rmDir(pathName);
			expect(() => fs.accessSync(pathName)).toThrowError(/ENOENT: no such file or directory/);
		});
	});
	describe('ensureCleanDir', () => {
		it('creates an empty dir if it did not exist', () => {
			fsUtil.ensureCleanDir(pathName);
			expect(fs.readdirSync(pathName)).toEqual([]);
		});
		it('cleans up an existing directory', () => {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'subdir'));
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'subdir', 'subfile.txt'), '123', 'utf8');
			fsUtil.ensureCleanDir(pathName);
			expect(fs.readdirSync(pathName)).toEqual([]);
		});
		it('creates the parent hierarchy as well', () => {
			fsUtil.ensureCleanDir(pathName + '/sub/dir');
			expect(fs.readdirSync(pathName)).toEqual(['sub']);
			expect(fs.readdirSync(path.join(pathName, 'sub'))).toEqual(['dir']);
			expect(fs.readdirSync(path.join(pathName, 'sub', 'dir'))).toEqual([]);
		});
	});
	describe('move', () => {
		it('moves a directory to a new location', () => {
			const newName = tmppath();
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'subdir'));
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'subdir', 'subfile.txt'), '123', 'utf8');
			fsUtil.move(pathName, newName);
			expect(() => fs.accessSync(pathName)).toThrowError(/ENOENT: no such file or directory/);
			expect(fs.readFileSync(path.join(newName, 'subdir', 'subfile.txt'), 'utf8')).toEqual('123');
			expect(fs.readFileSync(path.join(newName, 'file.txt'), 'utf8')).toEqual('123');
			fsUtil.rmDir(newName);
		});
		it('moves a file to a new location', () => {
			const newName = tmppath();
			fs.writeFileSync(pathName, '123', 'utf8');
			fsUtil.move(pathName, newName);
			expect(() => fs.accessSync(pathName)).toThrowError(/ENOENT: no such file or directory/);
			expect(fs.readFileSync(path.join(newName), 'utf8')).toEqual('123');
			fsUtil.rmDir(newName);
		});

		it('overwrites an existing file during move', () => {
			const newName = tmppath();
			fs.writeFileSync(newName, '345', 'utf8');
			fs.writeFileSync(pathName, '123', 'utf8');
			fsUtil.move(pathName, newName);
			expect(() => fs.accessSync(pathName)).toThrowError(/ENOENT: no such file or directory/);
			expect(fs.readFileSync(path.join(newName), 'utf8')).toEqual('123');
			fsUtil.rmDir(newName);
		});
	});

	describe('fileExists', () => {
		it('returns true for an existing file', () => {
			fs.writeFileSync(pathName, '123', 'utf8');
			expect(fsUtil.fileExists(pathName)).toBeTruthy();
		});
		it('returns false for a non-existing file', () => {
			expect(fsUtil.fileExists(pathName)).toBeFalsy();
		});
	});
	describe('isDir', () => {
		it('is false for non-existing paths', () => {
			expect(fsUtil.isDir(pathName)).toBeFalsy();
		});
		it('is false for files', () => {
			fs.writeFileSync(pathName, '123', 'utf8');
			expect(fsUtil.isDir(pathName)).toBeFalsy();
		});
		it('is true for directories', () => {
			fs.mkdirSync(pathName);
			expect(fsUtil.isDir(pathName)).toBeTruthy();
		});
	});
	describe('isLink', () => {
		it('is false for non-existing paths', () => {
			expect(fsUtil.isLink(pathName)).toBeFalsy();
		});
		it('is false for files', () => {
			fs.writeFileSync(pathName, '123', 'utf8');
			expect(fsUtil.isLink(pathName)).toBeFalsy();
		});
		it('is true for links', () => {
			const linkPath = path.resolve(pathName, 'link.txt'),
				filePath = path.resolve(pathName, 'file.txt');
			fs.mkdirSync(pathName);
			fs.writeFileSync(filePath, '123', 'utf8');
			fs.symlinkSync(filePath, linkPath);
			expect(fsUtil.isLink(linkPath)).toBeTruthy();
		});
	});
	describe('copy', () => {
		it('recursively copies a directory to another existing dir', () => {
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
		it('does not prepend source basename path if third arg is truthy', () => {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'content'));
			fs.mkdirSync(path.join(pathName, 'copy'));
			fs.mkdirSync(path.join(pathName, 'content', 'subdir'));
			fs.writeFileSync(path.join(pathName, 'content', 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'content', 'subdir', 'subfile.txt'), '456', 'utf8');

			fsUtil.copy(path.join(pathName, 'content'), path.join(pathName, 'copy'), true);

			expect(fs.readFileSync(path.join(pathName, 'copy', 'subdir', 'subfile.txt'), 'utf8')).toEqual('456');
			expect(fs.readFileSync(path.join(pathName, 'copy', 'file.txt'), 'utf8')).toEqual('123');
			expect(fs.readFileSync(path.join(pathName, 'content', 'subdir', 'subfile.txt'), 'utf8')).toEqual('456');
			expect(fs.readFileSync(path.join(pathName, 'content', 'file.txt'), 'utf8')).toEqual('123');
		});

		it('copies a file to an existing dir', () => {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'copy'));
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');

			fsUtil.copy(path.join(pathName, 'file.txt'), path.join(pathName, 'copy'));

			expect(fs.readFileSync(path.join(pathName, 'copy', 'file.txt'), 'utf8')).toEqual('123');

			expect(fs.readFileSync(path.join(pathName, 'file.txt'), 'utf8')).toEqual('123');
		});
		it('throws if the target directory does not exist', () => {
			fs.mkdirSync(pathName);
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');
			expect(() => fsUtil.copy(path.join(pathName, 'file.txt'), path.join(pathName, 'copy'))).toThrowError(/copy does not exist/);
		});
		it('throws if the target is a file', () => {
			fs.mkdirSync(pathName);
			fs.writeFileSync(path.join(pathName, 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'copy'), '123', 'utf8');
			expect(() => fsUtil.copy(path.join(pathName, 'file.txt'), path.join(pathName, 'copy'))).toThrowError(/copy is not a directory/);
		});
	});
	describe('recursiveList', () => {
		beforeEach(() => {
			fs.mkdirSync(pathName);
			fs.mkdirSync(path.join(pathName, 'content'));
			fs.mkdirSync(path.join(pathName, 'content', 'subdir'));
			fs.writeFileSync(path.join(pathName, 'content', 'file.txt'), '123', 'utf8');
			fs.writeFileSync(path.join(pathName, 'content', 'numbers.txt'), '331', 'utf8');
			fs.writeFileSync(path.join(pathName, 'content', 'subdir', 'subfile.txt'), '456', 'utf8');

			fs.mkdirSync(path.join(pathName, 'empty'));
		});
		describe('with absolute paths', () => {
			it('lists contents of a directory recursively', () => {
				expect(fsUtil.recursiveList(path.join(pathName, 'content')).sort()).toEqual(
						['file.txt', 'numbers.txt', 'subdir', 'subdir/subfile.txt']
				);
			});
			it('appends paths at each level of depth', () => {
				fs.mkdirSync(path.join(pathName, 'content', 'subdir', 'subsub'));
				fs.writeFileSync(path.join(pathName, 'content', 'subdir', 'subsub', 'subsubfile.txt'), '456', 'utf8');
				expect(fsUtil.recursiveList(path.join(pathName, 'content')).sort()).toEqual(
						['file.txt', 'numbers.txt', 'subdir', 'subdir/subfile.txt', 'subdir/subsub', 'subdir/subsub/subsubfile.txt']
				);

			});
			it('uses globbing patterns', () => {
				expect(fsUtil.recursiveList(path.join(pathName, 'content', '*.txt')).sort()).toEqual([
					path.join(pathName, 'content', 'file.txt'),
					path.join(pathName, 'content', 'numbers.txt')
				]);
			});
			it('lists a single file', () => {
				expect(fsUtil.recursiveList(path.join(pathName, 'content', 'file.txt'))).toEqual([path.join(pathName, 'content', 'file.txt')]);
			});
			it('lists a single file with globbing patterns', () => {
				expect(fsUtil.recursiveList(path.join(pathName, 'content', 'file*'))).toEqual([path.join(pathName, 'content', 'file.txt')]);
			});
			it('returns an empty array if no matching files', () => {
				expect(fsUtil.recursiveList(path.join(pathName, 'nx'))).toEqual([]);
			});
			it('returns an empty array if directory is empty', () => {
				expect(fsUtil.recursiveList(path.join(pathName, 'empty'))).toEqual([]);
			});
		});
		describe('with relative paths', () => {
			let cwd;
			beforeEach(() => {
				cwd = process.cwd();
				process.chdir(pathName);
			});
			afterEach(() => process.chdir(cwd));
			it('lists contents of a directory recursively', () => {
				expect(fsUtil.recursiveList('content').sort()).toEqual(
						['file.txt', 'numbers.txt', 'subdir', 'subdir/subfile.txt']
				);
			});
			it('uses globbing patterns', () => {
				expect(fsUtil.recursiveList('content/*.txt').sort()).toEqual([
					path.join('content', 'file.txt'),
					path.join('content', 'numbers.txt')
				]);
			});
			it('lists a single file', () => {
				expect(fsUtil.recursiveList(path.join('content', 'file.txt'))).toEqual([path.join('content', 'file.txt')]);
			});
			it('lists a single file with globbing patterns', () => {
				expect(fsUtil.recursiveList(path.join('content', 'file*'))).toEqual([path.join('content', 'file.txt')]);
			});
			it('returns an empty array if no matching files', () => {
				expect(fsUtil.recursiveList('nx')).toEqual([]);
			});
			it('returns an empty array if directory is empty', () => {
				expect(fsUtil.recursiveList('empty')).toEqual([]);
			});
		});
	});
	describe('silentRemove', () => {
		it('removes an existing file', () => {
			fs.writeFileSync(pathName, '123', 'utf8');
			fsUtil.silentRemove(pathName);
			expect(fsUtil.isFile(pathName)).toBeFalsy();
		});
		it('will not complain if the file does not exist', () => {
			expect(() => fsUtil.silentRemove(pathName)).not.toThrow();
		});
	});
	describe('isFile', () => {
		it('is false for non-existing paths', () => {
			expect(fsUtil.isFile(pathName)).toBeFalsy();
		});
		it('is true for files', () => {
			fs.writeFileSync(pathName, '123', 'utf8');
			expect(fsUtil.isFile(pathName)).toBeTruthy();
		});
		it('is false for directories', () => {
			fs.mkdirSync(pathName);
			expect(fsUtil.isFile(pathName)).toBeFalsy();
		});
	});
});
