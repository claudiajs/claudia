/*global describe, require, it, expect*/
var underTest = require('../src/util/find');
describe('find', function () {
	'use strict';
	it('returns the first element matching a predicate', function () {
		var result = underTest([10, 9, 12, 7], function (element) {
			return element % 3 === 0;
		});
		expect(result).toEqual(9);
	});
	it('returns false if no element matches', function () {
		var result = underTest([11, 9, 12, 7], function (element) {
			return element % 5 === 0;
		});
		expect(result).toBeFalsy();
	});
});
