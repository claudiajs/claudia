/*global describe, it, expect */
const expectedArchiveName = require('../src/util/expected-archive-name');
describe('expectedArchiveName', () => {
	'use strict';
	it('packages name, version and .tgz for non-scoped names', () => {
		expect(expectedArchiveName({name: 'hello-world', version: '1.0.0'})).toEqual('hello-world-1.0.0.tgz');
	});
	it('can set extension', () => {
		expect(expectedArchiveName({name: 'hello-world', version: '1.0.0'}, '.zip')).toEqual('hello-world-1.0.0.zip');
	});
	it('works for scoped packages', () => {
		expect(expectedArchiveName({ name: '@company/hello-world', version: '1.0.0' })).toEqual('company-hello-world-1.0.0.tgz');
		expect(expectedArchiveName({ name: '@company/hello-world', version: '1.0.0' }, '.zip')).toEqual('company-hello-world-1.0.0.zip');
	});
});
