/*global beforeEach, jasmine*/
beforeEach(function () {
	'use strict';
	jasmine.DEFAULT_TIMEOUT_INTERVAL = parseInt(process.env.TEST_TIMEOUT) || 150000;
});
