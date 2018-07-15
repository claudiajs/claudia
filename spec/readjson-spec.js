/*global describe, it, expect, beforeEach, afterEach */
const tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	underTest = require('../src/util/readjson');
describe('readjson', () => {
	'use strict';
	let workingfile;
	beforeEach(() => {
		workingfile = tmppath();
	});
	afterEach(() => {
		fsUtil.silentRemove(workingfile);
	});
	it('fails if the file is not provided', done => {
		underTest()
		.then(done.fail, message => expect(message).toEqual('file name not provided'))
		.then(done);
	});
	it('fails if the file is missing', done => {
		underTest(workingfile)
		.then(done.fail, message => expect(message).toEqual(workingfile + ' is missing'))
		.then(done);
	});
	it('fails if the file is not valid json', done => {
		fs.writeFileSync(workingfile, 'not-json', 'utf8');
		underTest(workingfile)
		.then(done.fail, message => expect(message).toEqual('invalid configuration in ' + workingfile))
		.then(done);
	});
	it('resolves with JSON-parsed contents', done => {
		fs.writeFileSync(workingfile, JSON.stringify({ pack: 'me' }), 'utf8');
		underTest(workingfile)
		.then(result => expect(result).toEqual({ pack: 'me' }))
		.then(done)
		.catch(done.fail);
	});
});
