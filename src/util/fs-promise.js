const fs = require('fs'),
	promisify = function (target, methodName) {
		'use strict';
		return function () {
			const originalArgs = Array.prototype.slice.call(arguments);
			return new Promise((resolve, reject) => {
				const cb = function (err, data) {
					if (err) {
						reject(err);
					} else {
						resolve(data);
					}
				};
				originalArgs.push(cb);
				target[methodName].apply(target, originalArgs);
			});
		};
	},
	build = function () {
		'use strict';
		const result = {},
			methods = ['writeFile', 'readFile', 'unlink', 'chmod', 'stat', 'rename', 'mkdtemp'];
		methods.forEach(method => result[`${method}Async`] = promisify(fs, method));
		return result;
	};
module.exports = build();


