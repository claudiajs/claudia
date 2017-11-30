const ApiBuilder = require('claudia-api-builder'),
	api = new ApiBuilder();

module.exports = api;

api.get('/hello', () => {
	'use strict';
	return 'hello world';
});
