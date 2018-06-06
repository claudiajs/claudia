let npmPath;
const removeKeysWithPrefix = require('./remove-keys-with-prefix'),
	which = require('which'),
	spawnPromise = require('./spawn-promise'),
	findNpm = function () {
		'use strict';
		if (npmPath) {
			return Promise.resolve(npmPath);
		}
		return new Promise((resolve, reject) => {
			which('npm', (err, path) => {
				if (err) {
					return reject(err);
				}
				npmPath = path;
				resolve(path);
			});
		});

	},
	toArgs = function (opts) {
		'use strict';
		if (!opts) {
			return [];
		}
		if (Array.isArray(opts)) {
			return opts;
		}
		if (typeof opts === 'string') {
			return opts.split(' ');
		}
		throw new Error('cannot convert to options', opts);
	};
module.exports = function runNpm(dir, options, logger, suppressOutput) {
	'use strict';
	const env = removeKeysWithPrefix(process.env, 'npm_'),
		args = toArgs(options),
		commandDesc = 'npm ' + args.join(' ');
	logger.logApiCall(commandDesc);
	return findNpm()
	.then(command => spawnPromise(command, args, {env: env, cwd: dir}, suppressOutput))
	.then(() => dir)
	.catch(() => {
		return Promise.reject(commandDesc + ' failed.');
	});
};
