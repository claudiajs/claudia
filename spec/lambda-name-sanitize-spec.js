/*global describe, it, expect, require */
var lambdaNameSanitize = require('../src/util/lambda-name-sanitize');
describe('lambdaNameSanitize', function () {
	'use strict';
	it('keeps alphanumeric characters, dash and underscore', function () {
		expect(lambdaNameSanitize('agaA293B-C_d123')).toEqual('agaA293B-C_d123');
	});
	it('replaces other characters with underscore', function () {
		expect(lambdaNameSanitize('ag.aA$29')).toEqual('ag_aA_29');
	});
	it('trims to 140 chars', function () {
		expect(lambdaNameSanitize(new Array(200).join('a')).length).toEqual(140);
	});
	it('creates a sensible name from scoped NPM packages', function () {
		expect(lambdaNameSanitize('@company/xyz')).toEqual('company_xyz');
	});
	it('trims spaces', function () {
		expect(lambdaNameSanitize(' bla bla ')).toEqual('bla_bla');
	});
});
