const patchEscape = require('./patch-escape');

module.exports = function createPatchArrayForTypes(existingBinaryTypes, requestedBinaryTypes) {
	'use strict';
	const toRemove = new Set(existingBinaryTypes || []),
		toAdd = new Set(requestedBinaryTypes || []),
		patchOps = [];

	if (requestedBinaryTypes) {
		requestedBinaryTypes.forEach(t => toRemove.delete(t));
	}
	if (existingBinaryTypes) {
		existingBinaryTypes.forEach(t => toAdd.delete(t));
	}

	toRemove.forEach(t => patchOps.push({op: 'remove', path: '/binaryMediaTypes/' + patchEscape(t)}));
	toAdd.forEach(t => patchOps.push({op: 'add', path: '/binaryMediaTypes/' + patchEscape(t)}));
	return patchOps;
};

