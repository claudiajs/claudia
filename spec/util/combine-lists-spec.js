const combineLists = require('../../src/util/combine-lists');
describe('combineLists', () => {
	'use strict';
	it('merges an array with first and removes elements from second csv list', () => {
		expect(combineLists(['1a', '1b', '1c'], '2a,2b', '1c,1a')).toEqual(['1b', '2a', '2b']);

	});
	it('works without the initial list being set', () => {
		expect(combineLists([], '2a,2b', '')).toEqual(['2a', '2b']);
		expect(combineLists(undefined, '2a,2b', false)).toEqual(['2a', '2b']);
	});
	it('works without the additional list being set', () => {
		expect(combineLists(['1a', '1b', '1c'], '', '1c,1a')).toEqual(['1b']);
		expect(combineLists(['1a', '1b', '1c'], false, '')).toEqual(['1a', '1b', '1c']);
	});
	it('works without the removal list being set', () => {
		expect(combineLists(['1a', '1b', '1c'], '2a,2b', '')).toEqual(['1a', '1b', '1c', '2a', '2b']);
		expect(combineLists(['1a', '1b', '1c'], '2a,2b', false)).toEqual(['1a', '1b', '1c', '2a', '2b']);
		expect(combineLists([], '2a,2b', false)).toEqual(['2a', '2b']);
	});
	it('works without any arguments', () => {
		expect(combineLists()).toEqual([]);
	});

});
