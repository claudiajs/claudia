/*global require, describe, it, beforeEach, afterEach, expect */
var shell = require('shelljs'),
	tmppath = require('../src/util/tmppath'),
	path = require('path'),
	fs = require('../src/util/fs-promise');
describe('fs-promise', function () {
	'use strict';
	var workingdir, testRunName, filePath;
	beforeEach(function () {
		workingdir = tmppath();
		shell.mkdir(workingdir);
		testRunName = 'test' + Date.now();
		filePath = path.join(workingdir, testRunName);
	});
	afterEach(function () {
		shell.rm('-rf', workingdir);
	});
	describe('readFileAsync', function () {
		it('reads file contents', function (done) {
			fs.writeFileSync(filePath, 'fileContents-123', 'utf8');
			fs.readFileAsync(filePath, 'utf8').then(function (contents) {
				expect(contents).toEqual('fileContents-123');
			}).then(done, done.fail);
		});
		it('fails if no file', function (done) {
			fs.readFileAsync(filePath, 'utf8').then(done.fail, done);
		});
	});
	describe('writeFileAsync', function () {
		it('writes file contents', function (done) {
			fs.writeFileAsync(filePath, 'fileContents-123', 'utf8').then(function () {
				var contents = fs.readFileSync(filePath, 'utf8');
				expect(contents).toEqual('fileContents-123');
			}).then(done, done.fail);
		});
	});
});
