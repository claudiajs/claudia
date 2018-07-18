/*global describe, it, expect*/
const isSQSArn = require('../src/util/is-sqs-arn');
describe('isSQSArn', () => {
	'use strict';
	it('is truthy for an ARN representing a kinesis stream', () => {
		expect(isSQSArn('arn:aws:sqs:us-east-1:123456789012:queue1')).toBeTruthy();
	});
	it('is falsy for different ARN types', () => {
		expect(isSQSArn('arn:aws:firehose:us-east-1:123456789012:deliverystream/example-stream-name')).toBeFalsy();
		expect(isSQSArn('arn:aws:kinesisanalytics:us-east-1:123456789012:application/example-application-name')).toBeFalsy();
		expect(isSQSArn('arn:aws:sts::123456789012:assumed-role/Accounting-Role/Mary')).toBeFalsy();
	});
	it('is falsy for non-arn values', () => {
		expect(isSQSArn('roleName')).toBeFalsy();
		expect(isSQSArn('')).toBeFalsy();
		expect(isSQSArn(false)).toBeFalsy();
	});
});
