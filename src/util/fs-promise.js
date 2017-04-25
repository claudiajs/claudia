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
	};

module.exports = {
	writeFileAsync: promisify(fs, 'writeFile'),
	readFileAsync: promisify(fs, 'readFile'),
	unlinkAsync: promisify(fs, 'unlink'),
	renameAsync: promisify(fs, 'rename')
};
