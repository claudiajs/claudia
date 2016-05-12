/*global module */
module.exports = function ArrayLogger() {
	'use strict';
	var self = this,
		combinedLog = [],
		unique = function (array) {
			var result = [];
			array.forEach(function (element) {
				if (result.indexOf(element) === -1) {
					result.push(element);
				}
			});
			return result;
		},
		pushLog = function (type, entries) {
			combinedLog.push([type].concat(Array.prototype.slice.apply(entries)));
		},
		extractLog = function (type) {
			return combinedLog.filter(function (entry) {
				return entry[0] === type;
			}).map(function (entry) {
				return entry[1];
			});
		};
	self.logStage = function () {
		pushLog('stage', arguments);
	};
	self.logApiCall = function () {
		pushLog('call', arguments);
	};
	self.getApiCallLog = function (removeDuplicates) {
		var apiCallLog = extractLog('call');
		if (removeDuplicates) {
			return unique(apiCallLog);
		} else {
			return apiCallLog;
		}
	};
	self.getApiCallLogForService = function (serviceName, removeDuplicates) {
		return self.getApiCallLog(removeDuplicates).filter(function (logEntry) {
			return logEntry.indexOf(serviceName + '.') === 0;
		});
	};
	self.getStageLog = function (removeDuplicates) {
		var stageLog = extractLog('stage');
		if (removeDuplicates) {
			return unique(stageLog);
		} else {
			return stageLog;
		}
	};
	self.getCombinedLog = function () {
		return combinedLog;
	};
};
