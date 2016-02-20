/*global describe, it, require, expect */
var underTest = require('../src/util/valid-http-code');
describe('validHttpCode', function () {
	'use strict';
	it('returns true for integers 200-599', function () {
		expect(underTest(199)).toBeFalsy();
		expect(underTest(0)).toBeFalsy();
		expect(underTest(-1)).toBeFalsy();
		expect(underTest(200)).toBeTruthy();
		expect(underTest(201)).toBeTruthy();
		expect(underTest(500)).toBeTruthy();
		expect(underTest(599)).toBeTruthy();
		expect(underTest(600)).toBeFalsy();
	});
	it('returns true for 200-599 strings as numbers', function () {
		expect(underTest('199')).toBeFalsy();
		expect(underTest('0')).toBeFalsy();
		expect(underTest('-1')).toBeFalsy();
		expect(underTest('200')).toBeTruthy();
		expect(underTest('201')).toBeTruthy();
		expect(underTest('500')).toBeTruthy();
		expect(underTest('599')).toBeTruthy();
		expect(underTest('600')).toBeFalsy();
	});
	it('returns false for structures', function () {
		expect(underTest({})).toBeFalsy();
		expect(underTest([])).toBeFalsy();
		expect(underTest({a: 1})).toBeFalsy();
		expect(underTest([1,2,3])).toBeFalsy();
	});
	it('returns false for non-numeric strings', function () {
		expect(underTest('abc')).toBeFalsy();
		expect(underTest('def203')).toBeFalsy();
		expect(underTest('201.4def')).toBeFalsy();
	});
	it('returns false for floats and float strings', function () {
		expect(underTest(302.3)).toBeFalsy();
		expect(underTest('302.3')).toBeFalsy();
	});
	it('returns false for booleans and falsy values', function () {
		expect(underTest(true)).toBeFalsy();
		expect(underTest(false)).toBeFalsy();
	});
});
