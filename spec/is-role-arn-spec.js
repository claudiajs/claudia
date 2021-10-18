const isRoleArn = require('../src/util/is-role-arn');
describe('isRoleArn', () => {
	'use strict';
	it('is truthy for an ARN representing an IAM role', () => {
		expect(isRoleArn('arn:aws:iam::123456789012:role/S3Access')).toBeTruthy();
	});
	it('is truthy for us-gov partition role ARNs', () => {
		expect(isRoleArn('arn:aws-us-gov:iam:us-gov-west-1:123456789012:role/S3Access')).toBeTruthy();
		expect(isRoleArn('arn:aws-us-gov:iam:us-gov-west-1:123456789012:role/application_abc/component_xyz/S3Access')).toBeTruthy();
	});
	it('is falsy for different ARN types', () => {
		expect(isRoleArn('arn:aws:iam::123456789012:policy/ManageCredentialsPermissions')).toBeFalsy();
		expect(isRoleArn('arn:aws:iam::123456789012:root')).toBeFalsy();
		expect(isRoleArn('arn:aws:sts::123456789012:assumed-role/Accounting-Role/Mary')).toBeFalsy();
	});
	it('is falsy for non-arn values', () => {
		expect(isRoleArn('roleName')).toBeFalsy();
		expect(isRoleArn('')).toBeFalsy();
		expect(isRoleArn(false)).toBeFalsy();
	});
});
