/*global module, require, console */
var path = require('path');
module.exports = function validatePackage(dir, functionHandler, restApiModule) {
	'use strict';
	var handlerComponents = functionHandler && functionHandler.split('.'),
		apiModulePath = handlerComponents && handlerComponents[0],
		handlerMethod = handlerComponents && handlerComponents[1],
		apiModule, apiConfig;
	if (restApiModule) {
		apiModulePath = restApiModule;
		handlerMethod = 'router';
	}
	try {
		apiModule = require(path.join(dir, apiModulePath));
	} catch (e) {
		console.error(e.stack || e);
		throw 'cannot require ./' + apiModulePath + ' after npm install --production. Check your dependencies.';
	}
	if (!apiModule[handlerMethod]) {
		if (restApiModule) {
			throw apiModulePath + '.js does not export a Claudia API Builder instance';
		} else {
			throw apiModulePath + '.js does not export method ' + handlerMethod;
		}
	}
	if (restApiModule) {
		try {
			apiConfig = apiModule.apiConfig && apiModule.apiConfig();
		} catch (e) {
			throw apiModulePath + '.js does not configure any API methods -- loading error';
		}
		if (!apiConfig || !apiConfig.routes || !Object.keys(apiConfig.routes).length) {
			throw apiModulePath + '.js does not configure any API methods';
		}
		if (apiConfig.version && apiConfig.version > 2) {
			throw apiModulePath + '.js uses an unsupported API version. Upgrade your claudia installation';
		}
		Object.keys(apiConfig.routes).forEach(function (route) {
			var routeConfig = apiConfig.routes[route];
			Object.keys(routeConfig).forEach(function (method) {
				var methodConfig = routeConfig[method];
				if (methodConfig.success && methodConfig.success.headers) {
					if (Object.keys(methodConfig.success.headers).length === 0) {
						throw apiModulePath + '.js ' + method + ' /' + route + ' requests custom headers but does not enumerate any headers';
					}
				}
				if (methodConfig.error && methodConfig.error.headers) {
					if (Object.keys(methodConfig.error.headers).length === 0) {
						throw apiModulePath + '.js ' + method + ' /' + route + ' error template requests custom headers but does not enumerate any headers';
					}
					if (Array.isArray(methodConfig.error.headers)) {
						throw apiModulePath + '.js ' + method + ' /' + route + ' error template requests custom headers but does not provide defaults';
					}
				}

			});
		});
	}
	return dir;
};

