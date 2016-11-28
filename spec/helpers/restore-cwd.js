/*global require, beforeEach, afterEach*/
var shell = require('shelljs'),
	cwd = shell.pwd();
beforeEach(function () {
	'use strict';
});
afterEach(function () {
	'use strict';
	shell.cd(cwd);
});
