const readline = require('readline'),
	ask = require('../../src/util/ask');
describe('ask', () => {
	'use strict';
	let fakeReadline;
	beforeEach(() => {
		fakeReadline = jasmine.createSpyObj('readline', ['question', 'close']);
		spyOn(readline, 'createInterface').and.returnValue(fakeReadline);
	});
	it('invokes the question without resolving the promise', done => {
		fakeReadline.question.and.callFake(prompt => {
			expect(readline.createInterface).toHaveBeenCalledWith({
				input: process.stdin,
				output: process.stdout
			});
			expect(prompt).toEqual('Hi there ');
			done();
		});
		ask('Hi there')
			.then(done.fail, done.fail);
	});
	it('rejects when the question throws error', done => {
		fakeReadline.question.and.throwError('BOOM');
		ask('Hi')
			.then(done.fail, err => expect(err.message).toEqual('BOOM'))
			.then(done);
	});
	it('rejects when the value is blank', done => {
		fakeReadline.question.and.callFake((prompt, callback) => callback(''));
		ask('Number')
			.then(done.fail, err => expect(err).toEqual('Number must be provided'))
			.then(done);
	});
	it('resolves with the value', done => {
		fakeReadline.question.and.callFake((prompt, callback) => callback('838'));
		ask('Number')
			.then(val => expect(val).toEqual('838'))
			.then(done, done.fail);
	});
});
