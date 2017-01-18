/*global describe, it, expect */
const underTest = require('../src/util/path-splitter');
describe('pathSplitter', () => {
	'use strict';
	it('breaks paths into parent and path part', () => {
		expect(underTest('')).toEqual({ parentPath: '', pathPart: '' });
		expect(underTest('/')).toEqual({ parentPath: '', pathPart: '' });
		expect(underTest('mike')).toEqual({ parentPath: '', pathPart: 'mike' });
		expect(underTest('/mike')).toEqual({ parentPath: '', pathPart: 'mike' });
		expect(underTest('mike/')).toEqual({ parentPath: '', pathPart: 'mike' });
		expect(underTest('/mike/')).toEqual({ parentPath: '', pathPart: 'mike' });
		expect(underTest('mike/tom')).toEqual({ parentPath: 'mike', pathPart: 'tom' });
		expect(underTest('mike/tom/')).toEqual({ parentPath: 'mike', pathPart: 'tom' });
		expect(underTest('mike/tom/tim')).toEqual({ parentPath: 'mike/tom', pathPart: 'tim' });
		expect(underTest('mike/tom/tim/')).toEqual({ parentPath: 'mike/tom', pathPart: 'tim' });
		expect(underTest('/mike/tom/tim/')).toEqual({ parentPath: 'mike/tom', pathPart: 'tim' });
	});
});
