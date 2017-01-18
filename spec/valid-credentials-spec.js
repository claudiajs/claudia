/*global describe, it, expect, require */
const validCredentials = require('../src/util/valid-credentials');
describe('validCredentials', () => {
	'use strict';
	//http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html
	const referenceIdentifiers = {
		'The root account - the account itself': 'arn:aws:iam::123456789012:root',
		'An IAM user in the account': 'arn:aws:iam::123456789012:user/Bob',
		'Another user with a path reflecting an organization chart': 'arn:aws:iam::123456789012:user/division_abc/subdivision_xyz/Bob',
		'An IAM group': 'arn:aws:iam::123456789012:group/Developers',
		'An IAM group with a path': 'arn:aws:iam::123456789012:group/division_abc/subdivision_xyz/product_A/Developers',
		'An IAM role': 'arn:aws:iam::123456789012:role/S3Access',
		'A managed policy': 'arn:aws:iam::123456789012:policy/ManageCredentialsPermissions',
		'An instance profile that can be associated with an EC2 instance': 'arn:aws:iam::123456789012:instance-profile/Webserver',
		'A federated user identified in IAM as "Bob"': 'arn:aws:sts::123456789012:federated-user/Bob',
		'The active session of someone assuming the role of "Accounting-Role", with a role session name of "Mary"':	'arn:aws:sts::123456789012:assumed-role/Accounting-Role/Mary',
		'The multi-factor authentication device assigned to the user named Bob': 'arn:aws:iam::123456789012:mfa/Bob',
		'A server certificate': 'arn:aws:iam::123456789012:server-certificate/ProdServerCert',
		'A server certificate with a path that reflects an organization chart': 'arn:aws:iam::123456789012:server-certificate/division_abc/subdivision_xyz/ProdServerCert',
		'Identity providers (SAML)': 'arn:aws:iam::123456789012:saml-provider/ADFSProvider',
		'Identify providers (OIDC)': 'arn:aws:iam::123456789012:oidc-provider/GoogleProvider'
	};
	Object.keys(referenceIdentifiers).forEach(key => {
		it('recognises ' + key, () => {
			expect(validCredentials(referenceIdentifiers[key])).toBeTruthy();
		});
	});
	it('recognises ARN masks', () => {
		expect(validCredentials('arn:aws:iam::*:role/apigAwsProxyRole')).toBeTruthy();
		expect(validCredentials('arn:aws:iam::*:user/*')).toBeTruthy();
		expect(validCredentials('arn:aws:iam::*:role/*')).toBeTruthy();
	});
	it('recognises true', () => {
		expect(validCredentials(true)).toBeTruthy();
	});
	it('does not recognise invalid format', () => {
		expect(validCredentials('xxx:aws:iam::*:role/apigAwsProxyRole')).toBeFalsy();
		expect(validCredentials('arn:aws:iam::*')).toBeFalsy();
		expect(validCredentials('arn:aws:iam:*:role/*')).toBeFalsy();
	});
	it('does not recognise non string truthy values', () => {
		expect(validCredentials([])).toBeFalsy();
		expect(validCredentials({a: 1})).toBeFalsy();
	});
});
