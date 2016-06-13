/*global require, describe, it, expect*/
var underTest = require('../src/util/trimslash');
describe('trimSlash', function () {
	'use strict';
	it('does not modify strings not ending with a slash', function () {
		expect(underTest('skufh')).toEqual('skufh');
		expect(underTest('')).toEqual('');
		expect(underTest('wukfe/a')).toEqual('wukfe/a');
		expect(underTest('/aa')).toEqual('/aa');
	});
	it('cuts of exactly one slash from the end', function () {
		expect(underTest('blah/')).toEqual('blah');
		expect(underTest('blah//')).toEqual('blah/');
		expect(underTest('/bl/ah/')).toEqual('/bl/ah');
		expect(underTest('/')).toEqual('');
	});
});
