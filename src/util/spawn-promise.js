const cp = require('child_process'),
	os = require('os');
module.exports = function spawnPromise(command, args, options, suppressOutput) {
	'use strict';
	const isWin = os.platform() === 'win32',
		actualCommand = isWin ? `"${command}"` : command,
		normalDefaults = {env: process.env, cwd: process.cwd()},
		windowsDefaults = Object.assign({shell: true}, normalDefaults),
		defaultOptions = isWin ? windowsDefaults : normalDefaults;

	if (isWin) {
		args.forEach((v, i) => {
			if (/\s/.test(v)) {
				args[i] =  `"${v}"`;
			}
		});
	}
	return new Promise((resolve, reject) => {
		const subProcess = cp.spawn(actualCommand, args, Object.assign(defaultOptions, options));
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
