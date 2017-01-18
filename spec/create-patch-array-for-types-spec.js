/*global describe, it, expect */
const createPatchArrayForTypes = require('../src/util/create-patch-array-for-types');
describe('createPatchArrayForTypes', () => {
	'use strict';
	it('returns add operations for all requested types if there are no existing types', () => {
		expect(createPatchArrayForTypes([], ['image/jpg', 'image/png'])).toEqual([
			{op: 'add', path: '/binaryMediaTypes/image~1jpg'},
			{op: 'add', path: '/binaryMediaTypes/image~1png'}
		]);
		expect(createPatchArrayForTypes(false, ['image/jpg', 'image/png'])).toEqual([
			{op: 'add', path: '/binaryMediaTypes/image~1jpg'},
			{op: 'add', path: '/binaryMediaTypes/image~1png'}
		]);
	});
	it('returns remove operations for all existing types if there are no requested types', () => {
		expect(createPatchArrayForTypes(['image/jpg', 'image/png'], [])).toEqual([
			{op: 'remove', path: '/binaryMediaTypes/image~1jpg'},
			{op: 'remove', path: '/binaryMediaTypes/image~1png'}
		]);
		expect(createPatchArrayForTypes(['image/jpg', 'image/png'], false)).toEqual([
			{op: 'remove', path: '/binaryMediaTypes/image~1jpg'},
			{op: 'remove', path: '/binaryMediaTypes/image~1png'}
		]);
	});
	it('returns an empty array if existing and requested are equal', () => {
		expect(createPatchArrayForTypes(['image/jpg', 'image/png'], ['image/jpg', 'image/png'])).toEqual([]);
	});
	it('ignores order when comparing for equality', () => {
		expect(createPatchArrayForTypes(['image/png', 'image/jpg'], ['image/jpg', 'image/png'])).toEqual([]);
	});
	it('returns the difference when both requested and existing are set', () => {
		expect(createPatchArrayForTypes(['image/jpg', 'image/png'], ['image/png', 'image/gif'])).toEqual([
			{op: 'remove', path: '/binaryMediaTypes/image~1jpg'},
			{op: 'add', path: '/binaryMediaTypes/image~1gif'}
		]);
	});
});
