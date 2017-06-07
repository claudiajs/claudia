/*global describe, require, it, expect */
const countElements = require('../src/util/count-elements');
describe('countElements', () => {
	'use strict';
	it('counts existing keys in an object matching the supplied array', () => {
		expect(countElements({a: 1, b: 2, c: 3}, [])).toEqual(0);
		expect(countElements({a: 1, b: 2, c: 3}, ['a'])).toEqual(1);
		expect(countElements({a: 1, b: 2, c: 3}, ['a', 'c'])).toEqual(2);
		expect(countElements({a: 1, b: 2, c: 3}, ['a', 'c', 'd'])).toEqual(2);
		expect(countElements({a: 1, b: 2, c: 3}, ['xa', 'xc', 'd'])).toEqual(0);
		expect(countElements({}, ['xa', 'xc', 'd'])).toEqual(0);
	});
	it('returns 0 if any of the args not defined', () => {
		expect(countElements(undefined, ['a'])).toEqual(0);
		expect(countElements({a: 1}, undefined)).toEqual(0);
	});
});
