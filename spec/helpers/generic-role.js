/*global beforeAll, afterAll, require, console */
const genericRole = require('../util/generic-role');
beforeAll(done => {
	'use strict';
	if (process.env.SKIP_AWS) {
		return done();
	}
	genericRole.create().then(done, err => {
		console.log('error creating generic role', err);
		done.fail(err);
	});
});
afterAll(done => {
	'use strict';
	if (process.env.SKIP_AWS) {
		return done();
	}
	genericRole.destroy().then(done, err => {
		console.log('error destroying generic role', err);
		done.fail(err);
	});
});
