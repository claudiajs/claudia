#!/usr/bin/env node

/*global jasmine*/
var Jasmine = require('jasmine'),
	SpecReporter = require('jasmine-spec-reporter'),
	noop = function () {},
	jrunner = new Jasmine();
if (process.argv[2] === 'full') {
	jrunner.configureDefaultReporter({print: noop});    // remove default reporter logs
	jasmine.getEnv().addReporter(new SpecReporter());   // add jasmine-spec-reporter
}
jrunner.loadConfigFile();                           // load jasmine.json configuration
jrunner.execute();
