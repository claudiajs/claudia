/*global describe, it, expect, beforeEach, afterEach, require */
var tmppath = require('../src/util/tmppath'),
	shell = require('shelljs'),
	fs = require('fs'),
	path = require('path'),
	os = require('os'),
	underTest = require('../src/tasks/zipdir');
describe('zipdir', function () {
	'use strict';
	var workingdir, zipfile, pwd;
	beforeEach(function () {
		workingdir = tmppath();
		shell.mkdir(workingdir);
		pwd = shell.pwd();
	});
	afterEach(function () {
		shell.cd(pwd);
		shell.rm('-rf', workingdir);
		if (zipfile) {
			shell.rm('-rf', zipfile);
		}
	});
	it('rejects if the path does not exist', function (done) {
		var argpath = tmppath();
		underTest(argpath).then(done.fail, function (reason) {
			expect(reason).toEqual(argpath + ' does not exist');
			done();
		});
	});
	it('rejects if the path is not a dir', function (done) {
		var filePath = path.join(workingdir, 'root.txt');
		fs.writeFileSync(filePath, 'text1', 'utf8');
		underTest(filePath).then(done.fail, function (reason) {
			expect(reason).toEqual(filePath + ' is not a directory');
			done();
		});
	});
	it('zips up files and subfolders into a temporary path', function (done) {
		var original = path.join(workingdir, 'original');
		shell.mkdir(original);
		fs.writeFileSync(path.join(original, 'root.txt'), 'text1', 'utf8');
		shell.mkdir(path.join(original, 'subdir'));
		fs.writeFileSync(path.join(original, 'subdir', 'sub.txt'), 'text2', 'utf8');

		underTest(original).then(function (argpath) {
			var unpacked = path.join(workingdir, 'unpacked');

			zipfile = argpath;
			shell.mkdir(unpacked);
			shell.cd(unpacked);
			if (shell.exec('unzip ' + argpath).code !== 0) {
				done.fail('invalid archive');
			}

			expect(path.dirname(argpath)).toEqual(os.tmpdir());
			expect(fs.readFileSync(path.join(unpacked, 'root.txt'), 'utf8')).toEqual('text1');
			expect(fs.readFileSync(path.join(unpacked, 'subdir', 'sub.txt'), 'utf8')).toEqual('text2');

			done();
		}, done.fail);
	});
});

