/*global describe, it, expect, beforeEach, afterEach, require */
var tmppath = require('../src/util/tmppath'),
	shell = require('shelljs'),
	fs = require('fs'),
	underTest = require('../src/util/readjson');
describe('readjson', function () {
	'use strict';
	var workingfile;
	beforeEach(function () {
		workingfile = tmppath();
	});
	afterEach(function () {
		if (shell.test('-e', workingfile)) {
			shell.rm('-rf', workingfile);
		}
	});
	it('fails if the file is not provided', function (done) {
		underTest().then(done.fail, function (message) {
			expect(message).toEqual('file name not provided');
			done();
		});
	});
	it('fails if the file is missing', function (done) {
		underTest(workingfile).then(done.fail, function (message) {
			expect(message).toEqual(workingfile + ' is missing');
			done();
		});
	});
	it('fails if the file is not valid json', function (done) {
		fs.writeFileSync(workingfile, 'not-json', 'utf8');
		underTest(workingfile).then(done.fail, function (message) {
			expect(message).toEqual('invalid configuration in ' + workingfile);
			done();
		});
	});
	it('resolves with JSON-parsed contents', function (done) {
		fs.writeFileSync(workingfile, JSON.stringify({pack: 'me'}), 'utf8');
		underTest(workingfile).then(function (result) {
			expect(result).toEqual({pack: 'me'});
			done();
		}, done.fail);
	});
});
