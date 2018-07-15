const fs = require('fs'),
	path = require('path'),
	fsExtra = require('fs-extra'),
	glob = require('glob'),
	safeStats = function (filePath) {
		'use strict';
		try {
			return fs.statSync(filePath);
		} catch (e) {
			return false;
		}
	},
	safeLStats = function (filePath) {
		'use strict';
		try {
			return fs.lstatSync(filePath);
		} catch (e) {
			return false;
		}
	};

exports.ensureCleanDir = function (dirPath) {
	'use strict';
	fsExtra.emptyDirSync(dirPath);
};
exports.silentRemove = exports.rmDir = function (dirPath) {
	'use strict';
	fsExtra.removeSync(dirPath);
};
exports.fileExists = function (filePath) {
	'use strict';
	return fs.existsSync(filePath);
};
exports.isDir = function (filePath) {
	'use strict';
	const stats = safeStats(filePath);
	return stats && stats.isDirectory();
};
exports.isFile = function (filePath) {
	'use strict';
	const stats = safeStats(filePath);
	return stats && stats.isFile();
};
exports.isLink = function (filePath) {
	'use strict';
	const stats = safeLStats(filePath);
	return stats && stats.isSymbolicLink();
};
exports.copy = function (from, to, doNotPrependPath) {
	'use strict';
	const stats = safeStats(to),
		target = doNotPrependPath ? to : path.join(to, path.basename(from));
	if (!stats) {
		throw new Error(`${to} does not exist`);
	}
	if (!stats.isDirectory()) {
		throw new Error(`${to} is not a directory`);
	}
	fsExtra.copySync(from, target, {dereference: true});
};
exports.recursiveList = function (filePath) {
	'use strict';
	const result = [],
		addDir = function (dirPath, prefix) {
			const entries = fs.readdirSync(dirPath);
			entries.forEach(entry => {
				const realEntryPath = path.join(dirPath, entry),
					entryStat = safeStats(realEntryPath),
					logicalPath = prefix ? path.join(prefix, entry) : entry;
				result.push(logicalPath);
				if (entryStat.isDirectory()) {
					addDir(realEntryPath, logicalPath);
				}
			});
		},
		filePathStats = safeStats(filePath);
	if (!filePathStats) {
		return glob.sync(filePath);
	}
	if (filePathStats.isFile()) {
		return [filePath];
	}
	if (filePathStats.isDirectory()) {
		addDir(filePath);
		return result;
	}
	return [];
};
exports.move = function (fromPath, toPath) {
	'use strict';
	fsExtra.moveSync(fromPath, toPath, {overwrite: true});
};
