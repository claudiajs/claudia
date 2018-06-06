const cp = require('child_process');
module.exports = function spawnPromise(command, args, options, suppressOutput) {
	'use strict';
	return new Promise((resolve, reject) => {
		const subProcess = cp.spawn(command, args, options);
		if (!suppressOutput) {
			subProcess.stdout.pipe(process.stdout);
		}
		subProcess.stderr.pipe(process.stderr);
		subProcess.on('close', (code) => {
			if (code > 0) {
				return reject(code);
			}
			resolve();
		});
		subProcess.on('error', reject);
	});
};
