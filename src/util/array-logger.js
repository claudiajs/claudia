module.exports = function ArrayLogger() {
	'use strict';
	const combinedLog = [],
		unique = function (array) {
			return Array.from(new Set(array));
		},
		pushLog = function (type, entries) {
			combinedLog.push([type].concat(Array.prototype.slice.apply(entries)));
		},
		extractLog = function (type) {
			return combinedLog
			.filter(entry => entry[0] === type)
			.map(entry => entry[1]);
		};
	this.logStage = function () {
		pushLog('stage', arguments);
	};
	this.logApiCall = function () {
		pushLog('call', arguments);
	};
	this.getApiCallLog = function (removeDuplicates) {
		const apiCallLog = extractLog('call');
		if (removeDuplicates) {
			return unique(apiCallLog);
		} else {
			return apiCallLog;
		}
	};
	this.getApiCallLogForService = (serviceName, removeDuplicates) => {
		return this.getApiCallLog(removeDuplicates).filter(logEntry => logEntry.indexOf(`${serviceName}.`) === 0);
	};
	this.getStageLog = function (removeDuplicates) {
		const stageLog = extractLog('stage');
		if (removeDuplicates) {
			return unique(stageLog);
		} else {
			return stageLog;
		}
	};
	this.getCombinedLog = function () {
		return combinedLog;
	};
};
