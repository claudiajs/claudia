/*global exports*/
exports.apiConfig = function () {
	'use strict';
	return {
		version: 2,
		authorizers: {
			first: { lambdaName: 'nameOnly' },
			second: { lambdaName: 'name', lambdaVersion: 'version' },
			third: { lambdaArn: 'arn' }
		},
		routes: {
			authorizers: { 'GET' : { authorizer: 'first', success: { contentType: 'text/html' }, error: { headers: {'Content-Type': 'xxx'}}},
			successCode: { 'GET' : { success: 302 } },
			enumeratedSuccessHeaders: { 'GET': { success: { headers: ['Mix', 'Max'] } } },
			defaultedSuccessHeaders: { 'GET': { success: { headers: {'Mix': 'Max'} } } },
			twoMethods:  { 'GET' : { success: 302 }, 'POST': { error: { code: 404 } } }
		}}
	};
};
exports.router = function (event, context) {
	'use strict';
	context.succeed(event);
};
