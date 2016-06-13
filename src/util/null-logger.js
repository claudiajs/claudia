/*global module*/
module.exports = function NullLogger() {
	'use strict';
	var self = this;
	self.logStage = function () {};
	self.logApiCall = function () {};
};
