/*global module, require */
var path = require('path'),
	aws = require('aws-sdk'),
	Promise = require('bluebird'),
	rebuildWebApi = require('./rebuild-web-api');
module.exports = function createWebApi(lambdaMetaData, options) {
	'use strict';
	var apiModule = require(path.join(options.source, options['api-module'])),
		apiConfig = apiModule.apiConfig(),
		apiGateway = Promise.promisifyAll(new aws.APIGateway({region: options.region})),
		restApiId;
	return apiGateway.createRestApiAsync({
		name: options.name
	}).then(function (result) {
		restApiId = result.id;
		return rebuildWebApi(lambdaMetaData.FunctionName, options.version, lambdaMetaData.FunctionArn, restApiId, apiConfig, options.region);
	}).then(function () {
		lambdaMetaData.apiId = restApiId;
		return lambdaMetaData;
	});
};

