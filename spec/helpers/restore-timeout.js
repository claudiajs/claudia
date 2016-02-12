/*global beforeEach, afterEach, jasmine*/
var originalTimeout;
beforeEach(function () {
	'use strict';
	originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
});
afterEach(function () {
	'use strict';
	jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
});
