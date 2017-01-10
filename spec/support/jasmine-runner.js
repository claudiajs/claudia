/*global jasmine*/
const Jasmine = require('jasmine'),
	SpecReporter = require('jasmine-spec-reporter'),
	jrunner = new Jasmine();
let filter;
process.argv.slice(2).forEach(option => {
	'use strict';
	if (option === 'full') {
		jasmine.getEnv().clearReporters();
		jasmine.getEnv().addReporter(new SpecReporter({
			displayStacktrace: 'all'
		}));
	}
	if (option === 'ci') {
		jasmine.getEnv().clearReporters();
		jasmine.getEnv().addReporter(new SpecReporter({
			displayStacktrace: 'all',
			displaySpecDuration: true,
			displaySuiteNumber: true,
			colors: false,
			prefixes: {
				success: '[pass] ',
				failure: '[fail] ',
				pending: '[skip] '
			}
		}));
	}
	if (option.match('^filter=')) {
		filter = option.match('^filter=(.*)')[1];
	}
});
jrunner.loadConfigFile(); // load jasmine.json configuration
jrunner.execute(undefined, filter);
