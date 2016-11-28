/*global module, Promise */
module.exports = function sequentialPromiseMap(array, generator) {
	'use strict';
	var results = [],
		items = (array && array.slice()) || [],
		sendSingle = function (item) {
			return generator(item).then(function (result) {
				results.push(result);
			});
		},
		sendAll = function () {
			if (!items.length) {
				return Promise.resolve(results);
			} else {
				return sendSingle(items.shift()).then(sendAll);
			}
		};
	return sendAll();
};
