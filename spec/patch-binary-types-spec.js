/*global describe, it, expect, beforeEach, afterEach */
const aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region'),
	patchBinaryTypes = require('../src/tasks/patch-binary-types'),
	retriableWrap = require('../src/util/retriable-wrap'),
	destroyObjects = require('./util/destroy-objects');
describe('patchBinaryTypes', () => {
	'use strict';
	let testRunName, apiId;
	const apiGateway = retriableWrap(new aws.APIGateway({region: awsRegion}));
	beforeEach(() => {
		testRunName = 'test' + Date.now();
	});
	afterEach(done => {
		destroyObjects({restApi: apiId}).then(done, done.fail);
	});
	it('adds new types to a blank API', done => {
		const newTypes = ['image/png', 'image/jpg'];
		apiGateway.createRestApiPromise({ name: testRunName })
			.then(result => apiId = result.id)
			.then(() => patchBinaryTypes(apiId, apiGateway, newTypes))
			.then(() => apiGateway.getRestApiPromise({restApiId: apiId}))
			.then(apiConfig => {
				expect(apiConfig.binaryMediaTypes).toEqual(newTypes);
			})
			.then(done, done.fail);
	});

	it('modifies types of an existing API', done => {
		const newTypes = ['image/png', 'image/gif'];
		apiGateway.createRestApiPromise({ name: testRunName, binaryMediaTypes: ['image/png', 'image/jpg'] })
			.then(result => apiId = result.id)
			.then(() => patchBinaryTypes(apiId, apiGateway, newTypes))
			.then(() => apiGateway.getRestApiPromise({restApiId: apiId}))
			.then(apiConfig => {
				expect(apiConfig.binaryMediaTypes).toEqual(newTypes);
			})
			.then(done, done.fail);
	});
	it('removes all types from an existing API', done => {
		apiGateway.createRestApiPromise({ name: testRunName, binaryMediaTypes: ['image/png', 'image/jpg'] })
			.then(result => apiId = result.id)
			.then(() => patchBinaryTypes(apiId, apiGateway, false))
			.then(() => apiGateway.getRestApiPromise({restApiId: apiId}))
			.then(apiConfig => {
				expect(apiConfig.binaryMediaTypes).toBeUndefined();
			})
			.then(done, done.fail);
	});
});
