module.exports = function patchLambdaFunctionAssociations(existingAssociations, eventTypes, lambdaArn) {
	'use strict';
	if (!eventTypes || !Array.isArray(eventTypes) || !eventTypes.length) {
		throw 'invalid-args';
	}
	if (!lambdaArn) {
		throw 'invalid-args';
	}
	if (!existingAssociations || !existingAssociations.Items || !Array.isArray(existingAssociations.Items)) {
		throw 'invalid-args';
	}
	eventTypes.forEach(eventType => {
		const currentAssociation = existingAssociations.Items.find(a => a.EventType === eventType);
		if (currentAssociation) {
			currentAssociation.LambdaFunctionARN = lambdaArn;
		} else {
			existingAssociations.Items.push({
				EventType: eventType,
				LambdaFunctionARN: lambdaArn
			});
		}
	});
	existingAssociations.Quantity = existingAssociations.Items.length;
	return existingAssociations;
};
