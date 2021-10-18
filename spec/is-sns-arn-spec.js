const isSNSArn = require('../src/util/is-sns-arn');
describe('isSNSArn', () => {
	'use strict';
	it('is truthy for an ARN representing a sns topic', () => {
		expect(isSNSArn('arn:aws:sns:*:123456789012:my_corporate_topic')).toBeTruthy();
	});
	it('is falsy for a SNS subscription', () => {
		expect(isSNSArn('arn:aws:sns:us-east-1:123456789012:my_corporate_topic:02034b43-fefa-4e07-a5eb-3be56f8c54ce')).toBeFalsy();
	});
	it('is truthy for ARNs from the us-gov region', () => {
		expect(isSNSArn('arn:aws-us-gov:sns:us-gov-west-1:123456789012:my_corporate_topic')).toBeTruthy();
	});
	it('is falsy for a SNS subscription from the us-gov region', () => {
		expect(isSNSArn('arn:aws-us-gov:sns:us-gov-west-1:123456789012:my_corporate_topic:02034b43-fefa-4e07-a5eb-3be56f8c54ce')).toBeFalsy();
	});
	it('is falsy for different ARN types', () => {
		expect(isSNSArn('arn:aws-us-gov:sqs:us-gov-west-1:123456789012:queue1')).toBeFalsy();
		expect(isSNSArn('arn:aws:firehose:us-east-1:123456789012:deliverystream/example-stream-name')).toBeFalsy();
		expect(isSNSArn('arn:aws:kinesisanalytics:us-east-1:123456789012:application/example-application-name')).toBeFalsy();
		expect(isSNSArn('arn:aws:sts::123456789012:assumed-role/Accounting-Role/Mary')).toBeFalsy();
	});
	it('is falsy for non-arn values', () => {
		expect(isSNSArn('roleName')).toBeFalsy();
		expect(isSNSArn('')).toBeFalsy();
		expect(isSNSArn(false)).toBeFalsy();
	});
});
