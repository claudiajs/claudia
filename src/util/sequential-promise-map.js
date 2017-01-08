module.exports = function sequentialPromiseMap(array, generator) {
	'use strict';
	const results = [],
		items = (array && array.slice()) || [],
		sendSingle = function (item) {
			return generator(item)
			.then(result => results.push(result));
		},
		sendAll = function () {
			if (!items.length) {
				return Promise.resolve(results);
			} else {
				return sendSingle(items.shift())
				.then(sendAll);
			}
		};
	return sendAll();
};
