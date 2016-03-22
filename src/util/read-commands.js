/*global module, __dirname, require */
var shell = require('shelljs'),
	path = require('path');
module.exports = function readCommands() {
	'use strict';
	var result = {};
	shell.ls(path.join(__dirname, '../commands')).forEach(function (fileName) {
		var cmdName = path.basename(fileName, '.js');
		result[cmdName] = require('../commands/' + cmdName);
		result[cmdName].command = cmdName;
	});
	return result;
};

