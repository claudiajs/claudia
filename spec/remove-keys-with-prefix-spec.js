/*global require, describe, it, expect */
var removeKeysWithPrefix = require('../src/util/remove-keys-with-prefix');
describe('removeKeysWithPrefix', function () {
	'use strict';
	it('keeps the same object if no keys match', function () {
		expect(removeKeysWithPrefix({ aloha: '123', hawaii: '345'}, 'xx')).toEqual({ aloha: '123', hawaii: '345'});
	});
	it('returns an empty object if all keys match', function () {
		expect(removeKeysWithPrefix({ aloha: '123', ahwaii: '345'}, 'a')).toEqual({});
	});
	it('removes only keys with a given prefix', function () {
		expect(removeKeysWithPrefix({ aloha: '123', absolute: 'vodka', islands: true, hawaii: '345'}, 'a')).toEqual({hawaii: '345', islands: true});
	});
	it('returns a clone of the original object', function () {
		var original = { aloha: '123', absolute: 'vodka', islands: true, hawaii: '345'},
			result;
		result = removeKeysWithPrefix(original, 'a');
		result.modified = true;
		expect(original).toEqual({ aloha: '123', absolute: 'vodka', islands: true, hawaii: '345'});
		original.modified = false;
		expect(result.modified).toBeTruthy();
	});
	it('returns the original value for non-objects', function () {
		expect(removeKeysWithPrefix('abc', 'a')).toEqual('abc');
	});
});
