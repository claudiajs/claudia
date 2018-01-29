/*global describe, it, expect, beforeEach */
const findCloudfrontBehavior = require('../src/tasks/find-cloudfront-behavior');
describe('findCloudfrontBehavior', () => {
	'use strict';
	let config;
	beforeEach(() => {
		config = {
			DefaultCacheBehavior: {
				TargetOriginId: 'Custom-123'
			},
			CacheBehaviors: {
				Quantity: 2,
				Items: [
					{
						TargetOriginId: 'Custom-345',
						PathPattern: '/dev'
					},
					{
						TargetOriginId: 'Custom-678',
						PathPattern: '/prod'
					}
				]
			}
		};
	});
	it('returns the default behavior if path not specified', () => {
		expect(findCloudfrontBehavior(config).TargetOriginId).toEqual('Custom-123');
	});
	it('returns the default behavior if * is specified', () => {
		expect(findCloudfrontBehavior(config, '*').TargetOriginId).toEqual('Custom-123');
	});
	it('returns a behavior matching the path if specified', () => {
		expect(findCloudfrontBehavior(config, '/dev').TargetOriginId).toEqual('Custom-345');
	});
	it('returns falsy if no matching behavior', () => {
		expect(findCloudfrontBehavior(config, '/non-existing')).toBeFalsy();
	});
});
