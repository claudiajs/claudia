/*global describe, it, expect*/
const isKinesisArn = require('../src/util/is-kinesis-arn');
describe('isKinesisArn', () => {
	'use strict';
	it('is truthy for an ARN representing a kinesis stream', () => {
		expect(isKinesisArn('arn:aws:kinesis:us-east-1:123456789012:stream/example-stream-name')).toBeTruthy();
	});
	it('is falsy for different ARN types', () => {
		expect(isKinesisArn('arn:aws:firehose:us-east-1:123456789012:deliverystream/example-stream-name')).toBeFalsy();
		expect(isKinesisArn('arn:aws:kinesisanalytics:us-east-1:123456789012:application/example-application-name')).toBeFalsy();
		expect(isKinesisArn('arn:aws:sts::123456789012:assumed-role/Accounting-Role/Mary')).toBeFalsy();
	});
	it('is falsy for non-arn values', () => {
		expect(isKinesisArn('roleName')).toBeFalsy();
		expect(isKinesisArn('')).toBeFalsy();
		expect(isKinesisArn(false)).toBeFalsy();
	});
});
