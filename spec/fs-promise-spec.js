/*global describe, it, beforeEach, afterEach, expect */
const path = require('path'),
	fs = require('fs'),
	os = require('os'),
	fsUtil = require('../src/util/fs-util'),
	fsPromise = require('../src/util/fs-promise');
describe('fs-promise', () => {
	'use strict';
	let workingdir, testRunName, filePath;
	beforeEach(() => {
		workingdir = fs.mkdtempSync(os.tmpdir());
		testRunName = 'test' + Date.now();
		filePath = path.join(workingdir, testRunName);
	});
	afterEach(() => {
		fsUtil.rmDir(workingdir);
	});
	describe('readFileAsync', () => {
		it('reads file contents', done => {
			fs.writeFileSync(filePath, 'fileContents-123', 'utf8');
			fsPromise.readFileAsync(filePath, 'utf8')
			.then(contents => expect(contents).toEqual('fileContents-123'))
			.then(done, done.fail);
		});
		it('fails if no file', done => {
			fsPromise.readFileAsync(filePath, 'utf8')
			.then(done.fail, done);
		});
	});
	describe('writeFileAsync', () => {
		it('writes file contents', done => {
			fsPromise.writeFileAsync(filePath, 'fileContents-123', 'utf8')
			.then(() => {
				const contents = fs.readFileSync(filePath, 'utf8');
				expect(contents).toEqual('fileContents-123');
			})
			.then(done, done.fail);
		});
	});
	describe('unlinkAsync', () => {
		it('removes a file', done => {
			fsPromise.writeFileAsync(filePath, 'fileContents-123', 'utf8')
			.then(() => fsPromise.unlinkAsync(filePath))
			.then(() => fs.accessSync(filePath))
			.then(done.fail, done);
		});
	});
	describe('renameAsync', () => {
		it('renames a file', done => {
			const newPath = path.join(workingdir, 'new-file.txt');
			fsPromise.writeFileAsync(filePath, 'fileContents-123', 'utf8')
			.then(() => fsPromise.renameAsync(filePath, newPath))
			.then(() => expect(fs.readFileSync(newPath, 'utf8')).toEqual('fileContents-123'))
			.then(() => fs.accessSync(filePath))
			.then(done.fail, done);
		});
	});
	describe('mkdtempAsync', () => {
		it('creates a temporary folder', done => {
			fsPromise.mkdtempAsync(path.join(workingdir, 'test1'))
			.then(result => {
				expect(fsUtil.isDir(result)).toBeTruthy();
				expect(path.resolve(path.dirname(result))).toEqual(path.resolve(workingdir));
				expect(path.basename(result)).toMatch(/^test1/);
			})
			.then(done, done.fail);
		});
	});
	describe('statAsync', () => {
		it('gets stats for a dir', done => {
			fsPromise.writeFileAsync(filePath, 'fileContents-123', 'utf8')
			.then(() => fsPromise.statAsync(filePath))
			.then(stat => {
				expect(stat.isDirectory()).toBeFalsy();
				expect(stat.isFile()).toBeTruthy();
			})
			.then(done, done.fail);
		});
	});
	describe('chmodAsync', () => {
		it('changes the file mode', done => {
			fsPromise.writeFileAsync(filePath, 'fileContents-123', 'utf8')
			.then(() => fsPromise.chmodAsync(filePath, 0o755))
			.then(() => fs.statSync(filePath))
			.then(stats => expect(stats.mode & 0o777).toEqual(0o755))
			.then(done, done.fail);
		});
	});
});
