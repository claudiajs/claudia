/*global describe, it, expect, beforeEach, afterEach*/
const underTest = require('../src/commands/generate'),
	tmppath = require('../src/util/tmppath'),
	shell = require('shelljs'),
	destroyObjects = require('./util/destroy-objects');

describe('generate', () => {
	'use strict';
	let testRunName, config, newObjects, workingdir;
	beforeEach(() => {
		workingdir = tmppath();
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
			shell.mkdir(workingdir);
			shell.cp('-r', 'app-templates/api.js', workingdir);
			underTest(config)
				.then(done.fail, message => expect(message).toEqual('A file with the same name exists at the provided location.'))
				.then(done);
		});
	});
});
