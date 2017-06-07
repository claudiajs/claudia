/*global describe, it, expect, require */
const mergeProperties = require('../src/util/merge-properties');
describe('mergeProperties', () => {
	'use strict';
	const mergeTest = function (to, from) {
		mergeProperties(to, from);
		return to;
	};
	it('overrides target properties', () => {
		expect(mergeTest({}, {a: 1})).toEqual({a: 1});
		expect(mergeTest({a: 2}, {a: 1})).toEqual({a: 1});
		expect(mergeTest({a: 2, b: 3}, {a: 1})).toEqual({a: 1, b: 3});
		expect(mergeTest({a: 2, b: 3}, {a: 1, b: 22})).toEqual({a: 1, b: 22});
		expect(mergeTest({a: 2, b: 3}, {a: 1, c: 33})).toEqual({a: 1, b: 3, c: 33});
	});
	it('does not modify the source object', () => {
		const from = {a: 1},
			to = { b: 1 };
		mergeProperties(to, from);
		expect(from).toEqual({a: 1});
	});
});
