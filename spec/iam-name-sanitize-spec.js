/*global describe, it, expect */
const iamNameSanitize = require('../src/util/iam-name-sanitize');
describe('iamNameSanitize', () => {
	'use strict';
	it('keeps alphanumeric characters, dash and underscore', () => {
		expect(iamNameSanitize('agaA293B-C_d123')).toEqual('agaA293B-C_d123');
	});
	it('replaces other characters with underscore', () => {
		expect(iamNameSanitize('ag.aA$29')).toEqual('ag_aA_29');
	});
});
