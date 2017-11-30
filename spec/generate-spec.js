/*global describe, it, expect, beforeEach, afterEach*/
const underTest = require('../src/commands/generate'),
	tmppath = require('../src/util/tmppath'),
	shell = require('shelljs'),
	path = require('path'),
	destroyObjects = require('./util/destroy-objects'),
	fsUtil = require('../src/util/fs-util');

describe('generate', () => {
	'use strict';
	let testRunName, config, newObjects, workingdir;
	beforeEach(() => {
		workingdir = tmppath();
		shell.mkdir(workingdir);
		testRunName = 'test' + Date.now();
		newObjects = { workingdir: workingdir };
		config = { name: testRunName, source: workingdir, _: ['generate', 'api'] };
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	describe('config validation', () => {

		it('fails if the generate template target is not provided', done => {
			config._ = ['generate'];
			underTest(config)
				.then(done.fail, message => expect(message).toEqual('Generate template is missing. If not familiar with the command, run claudia help.'))
				.then(done);
		});

		it('fails if the generate template target is unsupported.', done => {
			config._ = ['generate', 'api-1'];
			underTest(config)
				.then(done.fail, message => expect(message).toEqual('Specified template is not supported. If not familiar with the command, run claudia help.'))
				.then(done);
		});

		it('fails if the file with the template name already exists on the same location.', done => {
			shell.cp('-r', 'app-templates/api.js', workingdir);
			underTest(config)
				.then(done.fail, message => expect(message).toEqual('A file with the same name exists at the provided location.'))
				.then(done);
		});

	});

	describe('creates', () => {
		it('a hello-world template with a package.json if the hello-world command is set', done => {
			config._ = ['generate', 'hello-world'];
			underTest(config)
				.then(done.success, () => {
					expect(fsUtil.fileExists(path.join(workingdir, 'hello-world.js'))).toEqual(true);
					expect(fsUtil.fileExists(path.join(workingdir, 'package.json'))).toEqual(true);
				})
				.then(done);
		});

		it('an api template with a package.json if the api command is set', done => {
			config._ = ['generate', 'api'];
			underTest(config)
				.then(done.success, () => {
					expect(fsUtil.fileExists(path.join(workingdir, 'api.js'))).toEqual(true);
					expect(fsUtil.fileExists(path.join(workingdir, 'package.json'))).toEqual(true);
				})
				.then(done);
		});

	});
});
