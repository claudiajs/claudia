/*global exports, console*/
var apiConfig = function () {
	'use strict';
	return {
		version: 2,
		routes: { hello: { 'GET' : {} }}
	};
};

// No module.exports.apiConfig in this example
// module.exports.apiConfig = apiConfig;