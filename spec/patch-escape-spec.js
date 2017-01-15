/*global describe, it, expect */
const patchEscape = require('../src/util/patch-escape');
describe('patchEscape', () => {
	'use strict';
	it('replaces / with ~1', () => {
		expect(patchEscape('abc')).toEqual('abc');
		expect(patchEscape('')).toEqual('');
		expect(patchEscape('a/b')).toEqual('a~1b');
		expect(patchEscape('a/bcd/e/fg')).toEqual('a~1bcd~1e~1fg');
	});
});
