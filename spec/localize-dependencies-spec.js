/*global describe, it, expect, beforeEach, afterEach */
const os = require('os'),
	uuid = require('uuid'),
	path = require('path'),
	shell = require('shelljs'),
	readjson = require('../src/util/readjson'),
	fs = require('fs'),
	fsPromise = require('../src/util/fs-promise'),
	localizeDependencies = require('../src/tasks/localize-dependencies');
describe('localizeDependencies', () => {
	'use strict';
	let workdir, referencedir;
	beforeEach(() => {
		workdir = path.join(os.tmpdir(), uuid.v4());
		referencedir = path.join(os.tmpdir(), uuid.v4());
		shell.mkdir(workdir);
		shell.mkdir(referencedir);
	});
	afterEach(() => shell.rm('-rf', workdir, referencedir));
	it('does not modify package properties that have nothing to do with dependencies', done => {
		let referenceJSON;
		shell.cp(path.join(__dirname, '..', 'package.json'), workdir);
		localizeDependencies(workdir, referencedir)
		.then(() => readjson(path.join(__dirname, '..', 'package.json')))
		.then(contents => {
			referenceJSON = contents;
		})
		.then(() => readjson(path.join(workdir, 'package.json')))
		.then(contents => expect(contents).toEqual(referenceJSON))
		.then(done, done.fail);
	});
	it('complains if the working directory does not contain package.json', done => {
		localizeDependencies(workdir, referencedir)
		.then(done.fail, err => expect(err).toEqual(workdir + '/package.json is missing'))
		.then(done);
	});
	['dependencies', 'devDependencies', 'optionalDependencies'].forEach(depType => {
		const writeTemplate = function (overrideKey, value) {
			return readjson(path.join(__dirname, '..', 'package.json'))
			.then(content => {
				content[overrideKey] = value;
				return fsPromise.writeFileAsync(path.join(workdir, 'package.json'), JSON.stringify(content), { encoding: 'utf8' });
			});
		};
		it(`does not modify remote dependencies in ${depType}`, done => {
			const exampleDependencies = {
				'foo': '1.0.0 - 2.9999.9999',
				'bar': '>=1.0.2 <2.1.2',
				'baz': '>1.0.2 <=2.3.4',
				'boo': '2.0.1',
				'qux': '<1.0.0 || >=2.3.1 <2.4.5 || >=2.5.2 <3.0.0',
				'til': '~1.2',
				'elf': '~1.2.3',
				'two': '2.x',
				'thr': '3.3.x',
				'lat': 'latest',
				'git1': 'git://github.com/user/project.git#commit-ish',
				'http': 'http://asdf.com/asdf.tar.gz',
				'git2': 'git+ssh://user@hostname:project.git#commit-ish',
				'git3': 'git+ssh://user@hostname/project.git#commit-ish',
				'git4': 'git+http://user@hostname/project/blah.git#commit-ish',
				'git5': 'git+https://user@hostname/project/blah.git#commit-ish',
				'express': 'visionmedia/express',
				'mocha': 'visionmedia/mocha#4727d357ea'
			};
			writeTemplate(depType, exampleDependencies)
			.then(() => localizeDependencies(workdir, referencedir))
			.then(() => readjson(path.join(workdir, 'package.json')))
			.then(content => expect(content[depType]).toEqual(exampleDependencies))
			.then(done, done.fail);
		});
		it(`does not modify local dependencies that point to absolute paths in ${depType}`, done => {
			const exampleDependencies = {
				'homeRelative': '~/foo/bar',
				'absolute': '/foo/bar',
				'fileAbsolute': 'file:/foo/bar',
				'fileHome': 'file:~/foo/bar'
			};
			writeTemplate(depType, exampleDependencies)
			.then(() => localizeDependencies(workdir, referencedir))
			.then(() => readjson(path.join(workdir, 'package.json')))
			.then(content => expect(content[depType]).toEqual(exampleDependencies))
			.then(done, done.fail);
		});
		it(`modifies local dependencies in ${depType}`, done => {
			const exampleDependencies = {
				'parentRelative': '../foo/bar',
				'subdirRelative': './foo/bar',
				'fileRelative': 'file:../foo/bar',
				'fileSubdir': 'file:./foo/bar'
			};
			writeTemplate(depType, exampleDependencies)
			.then(() => localizeDependencies(workdir, referencedir))
			.then(() => readjson(path.join(workdir, 'package.json')))
			.then(content => {
				expect(content[depType]).toEqual({
					'parentRelative': 'file:' + path.resolve(referencedir, '../foo/bar'),
					'subdirRelative': 'file:' + path.resolve(referencedir, './foo/bar'),
					'fileRelative': 'file:' + path.resolve(referencedir, '../foo/bar'),
					'fileSubdir': 'file:' + path.resolve(referencedir, './foo/bar')
				});
			})
			.then(done, done.fail);
		});
	});
	it('does not create .npmrc if the original directory does not have one', done => {
		shell.cp(path.join(__dirname, '..', 'package.json'), workdir);
		localizeDependencies(workdir, referencedir)
		.then(() => expect(shell.test('-e', path.join(workdir, '.npmrc'))).toBeFalsy())
		.then(done, done.fail);
	});
	it('copies .npmrc if the original directory contains it', done => {
		fs.writeFileSync(path.join(referencedir, '.npmrc'), 'optional = false', 'utf8');
		shell.cp(path.join(__dirname, '..', 'package.json'), workdir);
		localizeDependencies(workdir, referencedir)
		.then(() => {
			const npmRcPath = path.join(workdir, '.npmrc');
			expect(shell.test('-e', npmRcPath)).toBeTruthy();
			expect(fs.readFileSync(npmRcPath, 'utf8')).toEqual('optional = false');
		})
		.then(done, done.fail);
	});
});
