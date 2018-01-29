/*global describe, it, expect*/
const patchLambdaFunctionAssociations = require('../src/tasks/patch-lambda-function-associations');
describe('patchLambdaFunctionAssociations', () => {
	'use strict';
	it('adds an initial event to an empty array', () => {
		expect(patchLambdaFunctionAssociations({
			Quantity: 0,
			Items: []
		}, ['viewer-request'], 'arn:1:2:3')
		).toEqual({
			Quantity: 1,
			Items: [
				{
					EventType: 'viewer-request',
					LambdaFunctionARN: 'arn:1:2:3'
				}
			]
		});
	});
	it('adds an new event to an existing array', () => {
		expect(patchLambdaFunctionAssociations({
			Quantity: 1,
			Items: [{
				EventType: 'viewer-response',
				LambdaFunctionARN: 'arn:2:3:4'
			}]
		}, ['viewer-request'], 'arn:1:2:3')
		).toEqual({
			Quantity: 2,
			Items: [
				{
					EventType: 'viewer-response',
					LambdaFunctionARN: 'arn:2:3:4'
				},
				{
					EventType: 'viewer-request',
					LambdaFunctionARN: 'arn:1:2:3'
				}
			]
		});
	});
	it('replaces an existing event', () => {
		expect(patchLambdaFunctionAssociations({
			Quantity: 1,
			Items: [{
				EventType: 'viewer-response',
				LambdaFunctionARN: 'arn:2:3:4'
			}]
		}, ['viewer-response'], 'arn:1:2:3')
		).toEqual({
			Quantity: 1,
			Items: [
				{
					EventType: 'viewer-response',
					LambdaFunctionARN: 'arn:1:2:3'
				}
			]
		});
	});
	it('works with an array of events', () => {
		expect(patchLambdaFunctionAssociations({
			Quantity: 1,
			Items: [{
				EventType: 'viewer-response',
				LambdaFunctionARN: 'arn:2:3:4'
			}, {
				EventType: 'origin-request',
				LambdaFunctionARN: 'arn:2:3:4'
			}]
		}, ['viewer-response', 'origin-response'], 'arn:1:2:3')
		).toEqual({
			Quantity: 3,
			Items: [
				{
					EventType: 'viewer-response',
					LambdaFunctionARN: 'arn:1:2:3'
				},
				{
					EventType: 'origin-request',
					LambdaFunctionARN: 'arn:2:3:4'
				},
				{
					EventType: 'origin-response',
					LambdaFunctionARN: 'arn:1:2:3'
				}
			]
		});
	});



});

