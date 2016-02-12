/*global require, beforeEach, afterEach*/
var cwd,
	shell = require('shelljs');
beforeEach(function () {
	'use strict';
	cwd = shell.pwd();
});
afterEach(function () {
	'use strict';
	shell.cd(cwd);
});
