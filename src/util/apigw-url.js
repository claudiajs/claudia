module.exports = function apiGWUrl(apiId, region, stage) {
	'use strict';
	return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
};
