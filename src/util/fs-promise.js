const fs = require('fs'),
	promisify = function (target, methodName) {
		'use strict';
		target[methodName + 'Async'] = function () {
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
	};

promisify(fs, 'writeFile');
promisify(fs, 'readFile');
promisify(fs, 'unlink');
promisify(fs, 'rename');

module.exports = fs;
