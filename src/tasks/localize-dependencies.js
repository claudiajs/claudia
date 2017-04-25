const fsPromise = require('../util/fs-promise'),
	path = require('path'),
	fsUtil = require('../util/fs-util'),
	readjson = require('../util/readjson');

module.exports = function (workdir, referencedir) {
	'use strict';
	const packagePath = path.join(workdir, 'package.json'),
		isLocalPath = function (str) {
			// startsWith not available in 0.10
			return str && (str[0] === '.' || str.indexOf('file:.') === 0);
		},
		localize = function (props) {
			if (!props) {
				return;
			}
			Object.keys(props).forEach(key => {
				if (isLocalPath(props[key])) {
					props[key] = 'file:' + path.resolve(referencedir, props[key].replace(/^file:/, ''));
				}
			});
		};
	return readjson(packagePath)
	.then(content => {
		['dependencies', 'devDependencies', 'optionalDependencies'].forEach(depType => localize(content[depType]));
		return content;
	})
	.then(content => fsPromise.writeFileAsync(packagePath, JSON.stringify(content), {encoding: 'utf8'}))
	.then(() => {
		const npmRcPath = path.join(referencedir, '.npmrc');
		if (fsUtil.fileExists(npmRcPath)) {
			fsUtil.copy(npmRcPath, workdir);
		}
	});
};
