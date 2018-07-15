/*global describe, it, expect, beforeEach, afterEach */
const underTest = require('../src/util/loadconfig'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	path = require('path');
describe('loadConfig', () => {
	'use strict';
	let workingdir, exampleConfig, cwd;
	beforeEach(() => {
		exampleConfig = { name: 'config' };
		workingdir = tmppath();
		fs.mkdirSync(workingdir);
		cwd = process.cwd();
	});
	afterEach(() => {
		process.chdir(cwd);
		fsUtil.silentRemove(workingdir);
	});
	it('loads config from the current directory if no directory provided', done => {
		process.chdir(workingdir);
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest()
		.then(config => expect(config).toEqual(exampleConfig))
		.then(done, done.fail);
	});
	it('loads config from the source directory if string provided', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir)
		.then(config => expect(config).toEqual(exampleConfig))
		.then(done, done.fail);
	});
	it('loads config from the source directory if object provided', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest({ source: workingdir })
		.then(config => expect(config).toEqual(exampleConfig))
		.then(done, done.fail);
	});
	it('loads config from an alternative file in the current dir, if config is provided', done => {
		process.chdir(workingdir);
		fs.writeFileSync(path.join(workingdir, 'lambda.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest({ config: 'lambda.json' })
		.then(config => expect(config).toEqual(exampleConfig))
		.then(done, done.fail);
	});
	it('loads config from an alternative file in a different dir, if config is provided', done => {
		fs.writeFileSync(path.join(workingdir, 'lambda.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest({ config: path.join(workingdir, 'lambda.json') })
		.then(config => expect(config).toEqual(exampleConfig))
		.then(done, done.fail);
	});
	it('complains about claudia.json if no config is given and claudia.json does not exist', done => {
		underTest({ source: workingdir })
		.then(done.fail, err => expect(err).toEqual('claudia.json does not exist in the source folder'))
		.then(done);
	});
	it('complains about the source path if config is given but does not exist', done => {
		const configPath = path.join(workingdir, 'lambda.json');
		underTest({ config: configPath })
		.then(done.fail, err => expect(err).toEqual(configPath + ' does not exist'))
		.then(done);
	});
	it('validates lambda name if required', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, { lambda: { name: true } })
		.then(done.fail, err => expect(err).toEqual('invalid configuration -- lambda.name missing from claudia.json'))
		.then(done);
	});
	it('passes name validation if name is provided', done => {
		exampleConfig = { lambda: {name: 'mike'} };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, { lambda: { name: true } })
		.then(config => expect(config).toEqual(exampleConfig))
		.then(done, done.fail);
	});

	it('validates lambda region if required', done => {
		exampleConfig = { lambda: { name: 'mike' } };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, { lambda: { region: true } })
		.then(done.fail, err => expect(err).toEqual('invalid configuration -- lambda.region missing from claudia.json'))
		.then(done);
	});
	it('passes region validation if name is provided', done => {
		exampleConfig = { lambda: { name: 'mike', region: 'us-east-1' } };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, { lambda: { region: true } })
		.then(config => expect(config).toEqual(exampleConfig))
		.then(done, done.fail);
	});

	it('validates lambda role if required', done => {
		exampleConfig = { lambda: { name: 'mike' } };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, { lambda: { role: true } })
		.then(done.fail, err => expect(err).toEqual('invalid configuration -- lambda.role missing from claudia.json'))
		.then(done);
	});
	it('passes role validation if name is provided', done => {
		exampleConfig = { lambda: { role: 'function-executor' } };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, { lambda: { role: true } })
		.then(config => expect(config.lambda.role).toEqual('function-executor'))
		.then(done, done.fail);
	});
	it('converts a role from an ARN to a name if ARN is specified', done => {
		exampleConfig = { lambda: { role: 'arn:aws:iam::333333333333:role/abcde-cli' } };
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify(exampleConfig), 'utf8');
		underTest(workingdir, { lambda: { role: true } })
		.then(config => expect(config.lambda.role).toEqual('abcde-cli'))
		.then(done, done.fail);
	});
});
