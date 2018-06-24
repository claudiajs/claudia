module.exports = function clearApi(apiGateway, restApiId, title) {
	'use strict';
	const apiTemplate = {
		swagger: '2.0',
		info: {
			title: title,
			version: String(Date.now())
		},
		paths: {
			'/': {}
		}
	};
	return apiGateway.putRestApiPromise({
		restApiId: restApiId,
		mode: 'overwrite',
		body: JSON.stringify(apiTemplate)
	});
};

