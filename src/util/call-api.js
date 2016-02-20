/*global require, module */
var https = require('https'),
	Promise = require('bluebird'),
	retry = require('./retry'),
	executeCall = function (callOptions) {
		'use strict';
		return new Promise(function (resolve, reject) {
			var req = https.request(callOptions);
			req.on('response', function (res) {
				var dataChunks = [];
				res.setEncoding('utf8');
				res.on('data', function (chunk) {
					dataChunks.push(chunk);
				});
				res.on('end', function () {
					var response = {
						headers: res.headers,
						body: dataChunks.join(''),
						statusCode: res.statusCode,
						statusMessage: res.statusMessage
					};
					if (callOptions.resolveErrors || (response.statusCode > 199 && response.statusCode < 400)) {
						resolve(response);
					} else {
						reject(response);
					}
				});
			}).on('error', function (e) {
				reject(e);
			});
			if (callOptions.body) {
				req.write(callOptions.body);
			}
			req.end();
		});
	};

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
		return executeCall(callOptions);
	} else {
		return retry(function () {
			return executeCall(callOptions);
		}, 3000, 5, function (err) {
			return err.statusCode === callOptions.retry;
		});
	}
};


