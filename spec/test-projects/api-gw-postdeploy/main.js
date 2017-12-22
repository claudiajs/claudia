/*global exports */
exports.apiConfig = function () {
	'use strict';
	return {
		version: 4,
		routes: { hello: { 'GET': {} }}
	};
};
exports.postDeploy = function (options, lambdaDetails, utils) {
	'use strict';
	const deployment = {
		restApiId: lambdaDetails.apiId,
		stageName: 'postdeploy',
		variables: {
			'postinstallfname': lambdaDetails.name,
			'postinstallalias': lambdaDetails.alias,
			'postinstallapiid': lambdaDetails.apiId,
			'postinstallapiUrl': lambdaDetails.apiUrl,
			'postinstallregion': lambdaDetails.region,
			'postinstalloption': options.postcheck,
			'lambdaVersion': lambdaDetails.alias,
			'hasAWS': (!!utils.aws).toString()
		}
	};
	return utils.apiGatewayPromise.createDeploymentPromise(deployment).then(() => {
		return {
			result: options.postresult,
			wasApiCacheUsed: !!lambdaDetails.apiCacheReused
		};
	});
};
exports.proxyRouter = function (event, context) {
	'use strict';
	context.succeed({
		body: JSON.stringify(event.stageVariables),
		headers: {
			'Content-Type': 'application/json'
		},
		statusCode: 200
	});
};
