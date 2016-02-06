/* global __dirname, require, module */
var shell = require('shelljs'),
	path = require('path'),
	readCommands = function () {
		'use strict';
		var result = {};
		shell.ls(path.join(__dirname, './src/commands')).forEach(function (fileName) {
			var cmdName = path.basename(fileName, '.js'),
				cmdFunc = require('./src/commands/' + cmdName);
			result[cmdFunc.name] = cmdFunc;
		});
		return result;
	};
module.exports = readCommands();

