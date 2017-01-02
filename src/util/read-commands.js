/*global module, __dirname, require */
var path = require('path'),
	fs = require('fs');
module.exports = function readCommands() {
	'use strict';
	var result = {};
	fs.readdirSync(path.join(__dirname, '../commands')).forEach(function (fileName) {
		var cmdName = path.basename(fileName, '.js');
		result[cmdName] = require('../commands/' + cmdName);
		result[cmdName].command = cmdName;
	});
	return result;
};

