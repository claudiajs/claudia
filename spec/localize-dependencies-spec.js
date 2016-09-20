/*global describe, it, expect, beforeEach, afterEach, require, __dirname */
var os = require('os'),
	uuid = require('uuid'),
	path = require('path'),
	shell = require('shelljs'),
	readjson = require('../src/util/readjson'),
	fs = require('fs'),
	Promise = require('bluebird'),
	writeFile = Promise.promisify(fs.writeFile),
	localizeDependencies = require('../src/tasks/localize-dependencies');
describe('localizeDependencies', function () {
	'use strict';
	var workdir, referencedir;
	beforeEach(function () {
		workdir = path.join(os.tmpdir(), uuid.v4());
		referencedir = '/abc/def';
		shell.mkdir(workdir);
	});
	afterEach(function () {
		shell.rm('-rf', workdir);
	});
	it('does not modify package properties that have nothing to do with dependencies', function (done) {
		var referenceJSON;
		shell.cp(path.join(__dirname, '..', 'package.json'), workdir);
		localizeDependencies(workdir, referencedir).then(function () {
			return readjson(path.join(__dirname, '..', 'package.json'));
		}).then(function (contents) {
			referenceJSON = contents;
		}).then(function () {
			return readjson(path.join(workdir, 'package.json'));
		}).then(function (contents) {
			expect(contents).toEqual(referenceJSON);
		}).then(done, done.fail);
	});
	it('complains if the working directory does not contain package.json', function (done) {
		localizeDependencies(workdir, referencedir).then(done.fail, function (err) {
			expect(err).toEqual(workdir + '/package.json is missing');
			done();
		});
	});
	['dependencies', 'devDependencies', 'optionalDependencies'].forEach(function (depType) {
		var writeTemplate = function (overrideKey, value) {
			return readjson(path.join(__dirname, '..', 'package.json')).then(function (content) {
				content[overrideKey] = value;
				return writeFile(path.join(workdir, 'package.json'), JSON.stringify(content), {encoding: 'utf8'});
			});
		};
		it('does not modify remote dependencies in ' + depType, function (done) {
			var exampleDependencies = {
				'foo' : '1.0.0 - 2.9999.9999',
				'bar' : '>=1.0.2 <2.1.2',
				'baz' : '>1.0.2 <=2.3.4',
				'boo' : '2.0.1',
				'qux' : '<1.0.0 || >=2.3.1 <2.4.5 || >=2.5.2 <3.0.0',
				'til' : '~1.2',
				'elf' : '~1.2.3',
				'two' : '2.x',
				'thr' : '3.3.x',
				'lat' : 'latest',
				'git1': 'git://github.com/user/project.git#commit-ish',
				'http': 'http://asdf.com/asdf.tar.gz',
				'git2': 'git+ssh://user@hostname:project.git#commit-ish',
				'git3': 'git+ssh://user@hostname/project.git#commit-ish',
				'git4': 'git+http://user@hostname/project/blah.git#commit-ish',
				'git5': 'git+https://user@hostname/project/blah.git#commit-ish',
				'express': 'visionmedia/express',
				'mocha': 'visionmedia/mocha#4727d357ea'
			};
			writeTemplate(depType, exampleDependencies).then(function () {
				return localizeDependencies(workdir, referencedir);
			}).then(function () {
				return readjson(path.join(workdir, 'package.json'));
			}).then(function (content) {
				expect(content[depType]).toEqual(exampleDependencies);
			}).then(done, done.fail);

		});
		it('does not modify local dependencies that point to absolute paths in ' + depType, function (done) {
			var exampleDependencies = {
				'homeRelative': '~/foo/bar',
				'absolute': '/foo/bar',
				'fileAbsolute': 'file:/foo/bar',
				'fileHome': 'file:~/foo/bar'
			};
			writeTemplate(depType, exampleDependencies).then(function () {
				return localizeDependencies(workdir, referencedir);
			}).then(function () {
				return readjson(path.join(workdir, 'package.json'));
			}).then(function (content) {
				expect(content[depType]).toEqual(exampleDependencies);
			}).then(done, done.fail);

		});
		it('modifies local dependencies in ' + depType, function (done) {
			var exampleDependencies = {
				'parentRelative': '../foo/bar',
				'subdirRelative': './foo/bar',
				'fileRelative': 'file:../foo/bar',
				'fileSubdir': 'file:./foo/bar'
			};
			writeTemplate(depType, exampleDependencies).then(function () {
				return localizeDependencies(workdir, referencedir);
			}).then(function () {
				return readjson(path.join(workdir, 'package.json'));
			}).then(function (content) {
				expect(content[depType]).toEqual({
					'parentRelative': 'file:' + path.resolve(referencedir, '../foo/bar'),
					'subdirRelative': 'file:' + path.resolve(referencedir, './foo/bar'),
					'fileRelative': 'file:' + path.resolve(referencedir, '../foo/bar'),
					'fileSubdir': 'file:' + path.resolve(referencedir, './foo/bar')
				});
			}).then(done, done.fail);
		});
	});

});
