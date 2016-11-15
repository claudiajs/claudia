/*global module, require */
var bluebird = require('bluebird');
module.exports = function sequentialPromiseMap(items, generator) {
	'use strict';
	return bluebird.map(items, generator, {concurrency: 1});
};
