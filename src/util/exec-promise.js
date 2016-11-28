/*global module, require, Promise */
var childProcess = require('child_process');
module.exports = function execPromise(command, options) {
	'use strict';
	return new Promise(function (resolve, reject) {
		childProcess.exec(command, options, function (err) {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
};
