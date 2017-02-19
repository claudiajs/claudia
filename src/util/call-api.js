const retry = require('oh-no-i-insist'),
	executeCall = require('minimal-request-promise');

module.exports = function callApi(apiId, region, path, options) {
	'use strict';
	const callOptions = {hostname: `${apiId}.execute-api.${region}.amazonaws.com`, port: 443, path: '/' + path, method: 'GET'},
		retryTimeout = options && options.retryTimeout || 3000,
		retries = options && options.retries || 5;
	if (options) {
		Object.keys(options).forEach(key => {
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
		return retry(() => executeCall(callOptions, Promise), retryTimeout, retries, err => err.statusCode === callOptions.retry, undefined, Promise);
	}
};
