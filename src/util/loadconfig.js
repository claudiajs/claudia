const path = require('path'),
	readjson = require('./readjson'),
	fsUtil = require('./fs-util'),
	getSourceDir = function (options) {
		'use strict';
		if (typeof options === 'string') {
			return options;
		} else if (options && options.source) {
			return options.source;
		} else {
			return process.cwd();
		}
	},
	configMissingError = function (options) {
		'use strict';
		if (options && options.config) {
			return `${options.config} does not exist`;
		}
		return 'claudia.json does not exist in the source folder';
	},
	toRoleName = function (roleNameOrArn) {
		'use strict';
		if (/^arn:aws:iam:.*/.test(roleNameOrArn)) {
			return roleNameOrArn.replace(/.*\//, '');
		}
		return roleNameOrArn;
	};


module.exports = function loadConfig(options, validate) {
	'use strict';
	const fileName = (options && options.config) || path.join(getSourceDir(options), 'claudia.json');

	validate = validate || {};

	if (!fsUtil.fileExists(fileName)) {
		return Promise.reject(configMissingError(options));
	}
	return readjson(fileName)
		.then(config => {
			const name = config && config.lambda && config.lambda.name,
				region = config && config.lambda && config.lambda.region,
				role = config && config.lambda && config.lambda.role;
			if (role) {
				config.lambda.role = toRoleName(role);
			}
			if (validate.lambda && validate.lambda.name && !name) {
				return Promise.reject('invalid configuration -- lambda.name missing from ' + path.basename(fileName));
			}
			if (validate.lambda && validate.lambda.region && !region) {
				return Promise.reject('invalid configuration -- lambda.region missing from claudia.json');
			}
			if (validate.lambda && validate.lambda.role && !role) {
				return Promise.reject('invalid configuration -- lambda.role missing from claudia.json');
			}
			return config;
		});
};
