const rebuildWebApi = require('./rebuild-web-api'),
	apiGWUrl = require('../util/apigw-url');

module.exports = function deployProxyApi(lambdaMetadata, options, ownerAccount, awsPartition, apiGatewayPromise, logger) {
	'use strict';
	const apiConfig = {
			version: 3,
			corsHandlers: true,
			routes: {
				'{proxy+}': { ANY: {}},
				'': { ANY: {}}
			},
			binaryMediaTypes: typeof options['binary-media-types'] === 'string'
				?	options['binary-media-types'].split(',').filter(a => a) : ['*/*']
		},
		alias = options.version || 'latest';
	logger.logStage('creating REST API');

	return apiGatewayPromise.createRestApiPromise({
		name: lambdaMetadata.FunctionName
	})
	.then(result => {
		lambdaMetadata.api = {
			id: result.id,
			url: apiGWUrl(result.id, options.region, alias)
		};
		return rebuildWebApi(lambdaMetadata.FunctionName, alias, result.id, apiConfig, ownerAccount, awsPartition, options.region, logger, options['cache-api-config']);
	})
	.then(() => lambdaMetadata);
};
