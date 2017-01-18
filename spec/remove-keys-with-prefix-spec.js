/*global describe, it, expect */
const removeKeysWithPrefix = require('../src/util/remove-keys-with-prefix');
describe('removeKeysWithPrefix', () => {
	'use strict';
	it('keeps the same object if no keys match', () => {
		expect(removeKeysWithPrefix({ aloha: '123', hawaii: '345' }, 'xx')).toEqual({ aloha: '123', hawaii: '345' });
	});
	it('returns an empty object if all keys match', () => {
		expect(removeKeysWithPrefix({ aloha: '123', ahwaii: '345' }, 'a')).toEqual({});
	});
	it('removes only keys with a given prefix', () => {
		expect(removeKeysWithPrefix({ aloha: '123', absolute: 'vodka', islands: true, hawaii: '345' }, 'a')).toEqual({ hawaii: '345', islands: true });
	});
	it('returns a clone of the original object', () => {
		const original = { aloha: '123', absolute: 'vodka', islands: true, hawaii: '345'},
			result = removeKeysWithPrefix(original, 'a');
		result.modified = true;
		expect(original).toEqual({ aloha: '123', absolute: 'vodka', islands: true, hawaii: '345' });
		original.modified = false;
		expect(result.modified).toBeTruthy();
	});
	it('returns the original value for non-objects', () => {
		expect(removeKeysWithPrefix('abc', 'a')).toEqual('abc');
	});
});
