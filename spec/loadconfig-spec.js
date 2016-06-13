/*global describe, it, expect, beforeEach, afterEach, require */
var underTest = require('../src/util/loadconfig'),
	tmppath = require('../src/util/tmppath'),
	shell = require('shelljs'),
	fs = require('fs'),
	path = require('path');
describe('loadConfig', function () {
	'use strict';
	var workingdir, exampleConfig;
	beforeEach(function () {
		exampleConfig = {name: 'config'};
		workingdir = tmppath();
		shell.mkdir(workingdir);
	});
	afterEach(function () {
		shell.rm('-rf', workingdir);
	});
	it('loads config from the current directory if no directory provided', function (done) {
		shell.cd(workingdir);
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest().then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});
	it('loads config from the source directory if string provided', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir).then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});
	it('loads config from the source directory if object provided', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest({source: workingdir}).then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});
	it('loads config from an alternative file in the current dir, if config is provided', function (done) {
		shell.cd(workingdir);
		fs.writeFileSync(path.join(workingdir, 'lambda.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest({config: 'lambda.json'}).then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});
	it('loads config from an alternative file in a different dir, if config is provided', function (done) {
		fs.writeFileSync(path.join(workingdir, 'lambda.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest({config: path.join(workingdir, 'lambda.json')}).then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});
	it('complains about claudia.json if no config is given and claudia.json does not exist', function (done) {
		underTest({source: workingdir}).then(done.fail, function (err) {
			expect(err).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('complains about the source path if config is given but does not exist', function (done) {
		var configPath = path.join(workingdir, 'lambda.json');
		underTest({config: configPath}).then(done.fail, function (err) {
			expect(err).toEqual(configPath + ' does not exist');
			done();
		});
	});
	it('validates lambda name if required', function (done) {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, {lambda: {name: true}}).then(done.fail, function (err) {
			expect(err).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('passes name validation if name is provided', function (done) {
		exampleConfig = { lambda: {name: 'mike'} };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, {lambda: {name: true}}).then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});

	it('validates lambda region if required', function (done) {
		exampleConfig = { lambda: {name: 'mike'} };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, {lambda: {region: true}}).then(done.fail, function (err) {
			expect(err).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});
	it('passes region validation if name is provided', function (done) {
		exampleConfig = { lambda: {name: 'mike', region: 'us-east-1'} };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, {lambda: {region: true}}).then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});

	it('validates lambda role if required', function (done) {
		exampleConfig = { lambda: {name: 'mike'} };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, {lambda: {role: true}}).then(done.fail, function (err) {
			expect(err).toEqual('invalid configuration -- lambda.role missing from claudia.json');
			done();
		});
	});
	it('passes region validation if name is provided', function (done) {
		exampleConfig = { lambda: {role: 'us-east-1'} };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, {lambda: {role: true}}).then(function (config) {
			expect(config).toEqual(exampleConfig);
		}).then(done, done.fail);
	});



});
