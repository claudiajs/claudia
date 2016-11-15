/*global require, module */
var Promise = require('bluebird');
module.exports = Promise.promisifyAll(require('fs'));

