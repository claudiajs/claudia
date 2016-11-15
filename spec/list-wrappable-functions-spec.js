/*global describe, expect, it, require */
var aws = require('aws-sdk'),
	listWrappableFunctions = require('../src/util/list-wrappable-functions'),
	iam = new aws.IAM();
describe('listWrappableFunctions', function () {
	'use strict';
	it('should identify methods', function () {
		expect(listWrappableFunctions(iam)).toContain('createRole');
	});
	it('should ignore generic methods', function () {
		expect(listWrappableFunctions(iam)).not.toContain('makeRequest');
	});
	it('should not contain any properties', function () {
		expect(listWrappableFunctions({ a: function () { }, b: 5})).toEqual(['a']);
	});
});
