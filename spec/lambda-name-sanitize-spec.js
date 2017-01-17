/*global describe, it, expect */
const lambdaNameSanitize = require('../src/util/lambda-name-sanitize');
describe('lambdaNameSanitize', () => {
	'use strict';
	it('keeps alphanumeric characters, dash and underscore', () => {
		expect(lambdaNameSanitize('agaA293B-C_d123')).toEqual('agaA293B-C_d123');
	});
	it('replaces other characters with underscore', () => {
		expect(lambdaNameSanitize('ag.aA$29')).toEqual('ag_aA_29');
	});
	it('trims to 140 chars', () => {
		expect(lambdaNameSanitize(new Array(200).join('a')).length).toEqual(140);
	});
	it('creates a sensible name from scoped NPM packages', () => {
		expect(lambdaNameSanitize('@company/xyz')).toEqual('company_xyz');
	});
	it('trims spaces', () => {
		expect(lambdaNameSanitize(' bla bla ')).toEqual('bla_bla');
	});
});
