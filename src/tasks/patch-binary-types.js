/*global module */
const createPatchArrayForTypes = require('../util/create-patch-array-for-types');
module.exports = function patchBinaryTypes(restApiId, apiGateway, requestedBinaryTypes) {
	'use strict';
	const applyPatchOps = function (patchOps) {
		if (patchOps.length) {
			return apiGateway.updateRestApiPromise({
				restApiId: restApiId,
				patchOperations: patchOps
			});
		}
	};
	return apiGateway.getRestApiPromise({restApiId: restApiId})
		.then(apiConfig => apiConfig && apiConfig.binaryMediaTypes)
		.then(existingTypes => createPatchArrayForTypes(existingTypes, requestedBinaryTypes)).
		then(applyPatchOps);
};
