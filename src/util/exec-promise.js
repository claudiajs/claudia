const exec = require('child_process').exec;
module.exports = function execPromise(command, options) {
	'use strict';
	return new Promise((resolve, reject) => {
		exec(command, options, err => {
			if (err) {
				return reject(err);
			}
			resolve();
		});
	});
};
