/*global jasmine, require, process*/
var Jasmine = require('jasmine'),
	SpecReporter = require('jasmine-spec-reporter'),
	noop = function () {},
	jrunner = new Jasmine(),
	filter;
if (process.argv[2] === 'full') {
	jrunner.configureDefaultReporter({print: noop});    // remove default reporter logs
	jasmine.getEnv().addReporter(new SpecReporter());   // add jasmine-spec-reporter
}
if (process.argv[2] && process.argv[2].match('^filter=')) {
	filter = process.argv[2].match('^filter=(.*)')[1];
}
jrunner.loadConfigFile();                           // load jasmine.json configuration
jrunner.execute(undefined, filter);
