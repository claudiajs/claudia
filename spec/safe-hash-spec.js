/* global describe, it, expect, require */
const safeHash = require('../src/util/safe-hash');
describe('safeHash', () => {
	'use strict';
	it('returns a base64 hash value of an object hash', () => {
		expect(safeHash({ a: 'b', c: 'd'})).toEqual('uFx9qT6HkFGImMKA4V4/GvXUa/SqpEB2kPDwo7AxZHg=');
	});
	it('uses the hash on the whole JSON of an object', () => {
		const ob = {version: 2, routes: { echo: {'GET': {} } }},
			objectHash = safeHash(ob);
		expect(objectHash).toEqual(safeHash(JSON.stringify(ob)));
		ob.version = 3;
		expect(objectHash).not.toEqual(safeHash(JSON.stringify(ob)));
	});
	it('replaces + with - to make it base64 safe', () => {
		expect(safeHash({a: 'b'})).toEqual('20p-yxFLxmxiOgbE/2/o2qL0nMJw6796H4HiKrBhyDc=');

	});
	it('hashes strings without JSON conversion', () => {
		expect(safeHash('wuehfwefh')).toEqual('uf0LsP/8koDqsSj5zmmfSt5fbUK-rjQq4xpnNPg-7kc=');
	});
});
