/*global describe, it, expect, require */
var expectedArchiveName = require('../src/util/expected-archive-name');
describe('expectedArchiveName', function () {
	'use strict';
	it('packages name, version and .tgz for non-scoped names', function () {
		expect(expectedArchiveName({name: 'hello-world', version: '1.0.0'})).toEqual('hello-world-1.0.0.tgz');
	});
	it('works for scoped packages', function () {
		expect(expectedArchiveName({name: '@company/hello-world', version: '1.0.0'})).toEqual('company-hello-world-1.0.0.tgz');
	});
});
