module.exports = function NullLogger() {
	'use strict';
	this.logStage = function () {};
	this.logApiCall = function () {};
};
