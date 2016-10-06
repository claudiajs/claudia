/*global exports */
exports.apiConfig = function () {
	'use strict';
	return {
		version: 3,
		routes: { hello: { 'GET' : {} }}
	};
};
exports.postDeploy = function (options, lambdaDetails, utils) {
	'use strict';
	var deployment = {
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
			'hasAWS': (!!utils.aws).toString(),
			'hasPromise': (!!utils.Promise).toString()
		}
	};
	return utils.apiGatewayPromise.createDeploymentPromise(deployment).then(function () {
		return options.postresult;
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
