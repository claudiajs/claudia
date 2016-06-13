/*global jasmine, require, process*/
var Jasmine = require('jasmine'),
	SpecReporter = require('jasmine-spec-reporter'),
	noop = function () {},
	jrunner = new Jasmine(),
	filter;
process.argv.slice(2).forEach(function (option) {
	'use strict';
	if (option === 'full') {
		jrunner.configureDefaultReporter({print: noop});    // remove default reporter logs
		jasmine.getEnv().addReporter(new SpecReporter());   // add jasmine-spec-reporter
	}
	if (option.match('^filter=')) {
		filter = option.match('^filter=(.*)')[1];
	}
});
jrunner.loadConfigFile();                           // load jasmine.json configuration
jrunner.execute(undefined, filter);
