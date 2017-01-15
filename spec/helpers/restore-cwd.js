/*global require, beforeEach, afterEach*/
const shell = require('shelljs'),
	cwd = shell.pwd();
beforeEach(() => {
	'use strict';
});
afterEach(() => {
	'use strict';
	shell.cd(cwd);
});
