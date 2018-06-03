module.exports = function expectedArchiveName(packageConfig, extension) {
	'use strict';
	return packageConfig.name.replace(/^@/, '').replace(/\//, '-') + '-' + packageConfig.version + (extension || '.tgz');
};
