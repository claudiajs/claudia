/*global afterAll, require, console */
const genericQueue = require('../util/generic-queue');
afterAll(done => {
	'use strict';
	genericQueue.destroy().then(done, err => {
		console.log('error destroying generic queue', err);
		done.fail(err);
	});
});
