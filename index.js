/* global __dirname, require, module */
const shell = require('shelljs'),
	path = require('path'),
	readCommands = function () {
		'use strict';
		const result = {};
		shell.ls(path.join(__dirname, './src/commands')).forEach(fileName => {
			const cmdName = path.basename(fileName, '.js'),
				cmdFunc = require(`./src/commands/${cmdName}`);
			result[cmdFunc.name] = cmdFunc;
		});
		return result;
	};
module.exports = readCommands();
