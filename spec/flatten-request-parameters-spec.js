/*global describe, it, expect */
const underTest = require('../src/tasks/flatten-request-parameters');
describe('flattenRequestParameters', () => {
	'use strict';
	it('returns false for falsy objects', () => {
		expect(underTest(false)).toEqual(false);
		expect(underTest(undefined)).toEqual(undefined);
		expect(underTest({})).toEqual({});
	});
	it('squashes querystring parameters', () => {
		expect(underTest({
			querystring: {
				'tim': true,
				'tom': false
			}
		})).toEqual({
			'method.request.querystring.tim': true,
			'method.request.querystring.tom': false
		});
	});
	it('squashes header parameters', () => {
		expect(underTest({
			header: {
				'tim': true,
				'tom': false
			}
		})).toEqual({
			'method.request.header.tim': true,
			'method.request.header.tom': false
		});
	});
	it('squashes mixed querystring/header parameters', () => {
		expect(underTest({
			header: {
				'tim': true
			},
			querystring: {
				'tom': false
			}
		})).toEqual({
			'method.request.header.tim': true,
			'method.request.querystring.tom': false
		});
	});
	it('clones direct string params', () => {
		expect(underTest({
			'method.request.querystring.name': true
		})).toEqual({
			'method.request.querystring.name': true
		});
	});
	it('parses path params', () => {
		expect(underTest(false, '/echo/{name}/{lastName}')).toEqual({
			'method.request.path.name': true,
			'method.request.path.lastName': true
		});
	});
	it('parses path params when ending with slash', () => {
		expect(underTest(undefined, '/echo/{name}/{lastName}/')).toEqual({
			'method.request.path.name': true,
			'method.request.path.lastName': true
		});
	});
	it('parses path params when starting with a dynamic param', () => {
		expect(underTest(undefined, '/{name}')).toEqual({
			'method.request.path.name': true
		});
	});
	it('uses greedy without +', () => {
		expect(underTest(undefined, '/echo/{proxy+}')).toEqual({
			'method.request.path.proxy': true
		});
	});
	it('does not include path params for static paths', () => {
		expect(underTest(undefined, '/echo/name/lastName')).toBeFalsy();
	});
	it('will mix paths params and explicit params', () => {
		expect(underTest({
			header: {
				'tim': true
			},
			querystring: {
				'tom': false
			}
		}, '/echo/{name}/')).toEqual({
			'method.request.header.tim': true,
			'method.request.querystring.tom': false,
			'method.request.path.name': true
		});
	});
});
