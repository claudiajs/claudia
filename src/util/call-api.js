/*global require, module, Promise */
var retry = require('oh-no-i-insist'),
	executeCall = require('minimal-request-promise');

module.exports = function callApi(apiId, region, path, options) {
	'use strict';
	var callOptions = {hostname: apiId + '.execute-api.' + region + '.amazonaws.com', port: 443, path: '/' + path, method: 'GET'};
	if (options) {
		Object.keys(options).forEach(function (key) {
			callOptions[key] = options[key];
		});
	}
	if (callOptions.body) {
		if (!callOptions.headers) {
			callOptions.headers = {};
		}
		callOptions.headers['Content-Length'] = callOptions.body.length;
	}
	if (!callOptions.retry) {
		return executeCall(callOptions, Promise);
	} else {
		return retry(function () {
			return executeCall(callOptions, Promise);
		}, 3000, 5, function (err) {
			return err.statusCode === callOptions.retry;
		}, undefined, Promise);
	}
};


