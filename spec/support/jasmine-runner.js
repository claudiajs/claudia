/*global jasmine, require, process*/
const Jasmine = require('jasmine'),
	SpecReporter = require('jasmine-spec-reporter'),
	jrunner = new Jasmine(),
	runJasmine = function () {
		'use strict';
		let filter;
		process.argv.slice(2).forEach(option => {
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
		jrunner.loadConfig({
			'spec_dir': 'spec',
			'spec_files': [
				'**/*[sS]pec.js'
			],
			'helpers': [
				'helpers/**/*.js'
			]
		});
		jrunner.execute(undefined, filter);
	};

runJasmine();
