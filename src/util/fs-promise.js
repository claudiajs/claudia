const fs = require('fs'),
	util = require('util'),
	build = function () {
		'use strict';
		const result = {},
			methods = ['writeFile', 'readFile', 'unlink', 'chmod', 'stat', 'rename', 'mkdtemp', 'mkdir'];
		methods.forEach(method => result[`${method}Async`] = util.promisify(fs[method]));
		return result;
	};
module.exports = build();


