/*global beforeAll, afterAll, require, console */
const genericRole = require('../util/generic-role');
beforeAll(done => {
	'use strict';
	genericRole.create().then(done, err => {
		console.log('error creating generic role', err);
		done.fail(err);
	});
});
afterAll(done => {
	'use strict';
	genericRole.destroy().then(done, err => {
		console.log('error destroying generic role', err);
		done.fail(err);
	});
});
