/*global module, require, __dirname*/
var path = require('path');
module.exports = function templateFile(fileName) {
	'use strict';
	return path.join(__dirname, '..', '..', 'json-templates', fileName);
};
