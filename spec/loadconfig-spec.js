/*global describe, it, expect, beforeEach, afterEach, require */
var tmppath = require('../src/util/tmppath'),
	shell = require('shelljs'),
	fs = require('fs'),
	underTest = require('../src/tasks/loadconfig');
describe('loadconfig', function () {
	'use strict';
	var workingdir, pwd;
	beforeEach(function () {
		workingdir = tmppath();
		shell.mkdir(workingdir);
		pwd = shell.pwd();
		shell.cd(workingdir);
	});
	afterEach(function () {
		shell.cd(pwd);
		shell.rm('-rf', workingdir);
	});
	it('fails if package.json is missing', function (done) {
		underTest().then(done.fail, function (message) {
			expect(message).toEqual('package.json is missing');
			done();
		});
		it('fails if package.json is not valid json', function (done) {
			fs.writeFileSync('package.json', 'not-json', 'utf8');
			underTest().then(done.fail, function (message) {
				expect(message).toEqual('invalid configuration in package.json');
				done();
			});
		});
	});
	describe('when package.json is present', function () {
		beforeEach(function () {
			fs.writeFileSync('package.json', JSON.stringify({pack: 'me'}), 'utf8');
		});
		it('fails if beamup.json is not in the current working dir', function (done) {
			underTest().then(done.fail, function (message) {
				expect(message).toEqual('beamup.json is missing');
				done();
			});
		});
		it('fails if beamup.json is not valid json', function (done) {
			fs.writeFileSync('beamup.json', 'not-json', 'utf8');
			underTest().then(done.fail, function (message) {
				expect(message).toEqual('invalid configuration in beamup.json');
				done();
			});
		});
		it('succeeds with package.json only if called with true', function (done) {
			underTest(true).then(function (result) {
				expect(result.package).toEqual({pack: 'me'});
				expect(result.config).toBeFalsy();
				done();
			}, done.fail);
		});

	});
	describe('when both package.json and beamup.json are present', function () {
		beforeEach(function () {
			fs.writeFileSync('beamup.json', JSON.stringify({a: 'b'}), 'utf8');
			fs.writeFileSync('package.json', JSON.stringify({pack: 'me'}), 'utf8');
		});
		it('returns the contents of beamup.json as config', function (done) {
			underTest().then(function (result) {
				expect(result.config).toEqual({a: 'b'});
				done();
			}, done.fail);
		});
		it('returns the contents of package.json as package', function (done) {
			underTest().then(function (result) {
				expect(result.package).toEqual({pack: 'me'});
				done();
			}, done.fail);
		});
	});

});
