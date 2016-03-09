/*global require */
var os = require('os')
module.exports.tmpdir = function() {
	var t = os.tmpdir();
	return t.substr(-1) === '/' ? t.substr(0, t.length - 1) : t;
};