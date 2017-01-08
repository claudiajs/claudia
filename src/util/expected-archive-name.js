module.exports = function expectedArchiveName(packageConfig) {
	'use strict';
	return packageConfig.name.replace(/^@/, '').replace(/\//, '-') + '-' + packageConfig.version + '.tgz';
};
