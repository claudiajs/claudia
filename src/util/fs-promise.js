/*global require, module, Promise */
var fs = require('fs'),
	promisify = function (target, methodName) {
		'use strict';
		target[methodName + 'Async'] = function () {
			var originalArgs = Array.prototype.slice.call(arguments);
			return new Promise(function (resolve, reject) {
				var cb = function (err, data) {
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

module.exports = fs;

