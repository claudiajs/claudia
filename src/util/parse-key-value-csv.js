/*global module */
module.exports = function parseKeyValueCSV(string) {
	'use strict';
	var result = {};
	if (!string || !string.trim().length) {
		throw 'Invalid CSV value';
	}
	string.trim().split(',').forEach(function (pair) {
		var keyval = pair && pair.split('=');
		if (!keyval || keyval.length < 2) {
			throw 'Invalid CSV element ' + pair;
		}
		result[keyval[0]] = keyval.slice(1).join('=');
	});
	return result;
};
