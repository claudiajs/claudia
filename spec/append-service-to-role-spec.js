/*global describe, it, expect */
const appendServiceToRole = require('../src/tasks/append-service-to-role');
describe('appendServiceToRole', () => {
	'use strict';
	it('adds a service if the statement does not exist', () => {
		expect(appendServiceToRole('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}', 'edgelambda.amazonaws.com'))
			.toEqual('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"},{"Effect":"Allow","Principal":{"Service":"edgelambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}', 'edgelambda.amazonaws.com');
	});
	it('does not add a service if it already exists in the role array', () => {
		expect(appendServiceToRole('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":["lambda.amazonaws.com","iam.amazonaws.com"]},"Action":"sts:AssumeRole"}]}', 'lambda.amazonaws.com'))
			.toEqual('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":["lambda.amazonaws.com","iam.amazonaws.com"]},"Action":"sts:AssumeRole"}]}');
	});
	it('checks for Allow', () => {
		expect(appendServiceToRole('{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Principal":{"Service":["lambda.amazonaws.com","iam.amazonaws.com"]},"Action":"sts:AssumeRole"}]}', 'lambda.amazonaws.com'))
			.toEqual('{"Version":"2012-10-17","Statement":[{"Effect":"Deny","Principal":{"Service":["lambda.amazonaws.com","iam.amazonaws.com"]},"Action":"sts:AssumeRole"},{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}');
	});
	it('checks for sts:AssumeRole', () => {
		expect(appendServiceToRole('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":["lambda.amazonaws.com","iam.amazonaws.com"]},"Action":"sts:SomethingElse"}]}', 'lambda.amazonaws.com'))
			.toEqual('{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":["lambda.amazonaws.com","iam.amazonaws.com"]},"Action":"sts:SomethingElse"},{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}');
	});
});
