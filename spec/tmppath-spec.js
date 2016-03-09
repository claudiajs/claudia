/*global describe, it, expect, require */
var underTest = require ('../src/util/tmppath'),
	path = require('path'),
	os = require('os'),
	tmpdir = require('./helpers/tmpdir.js'),
	fs = require('fs');
describe('tmppath', function () {
	'use strict';
	it('returns an uuid v4 subpath of tmpdir without any arguments', function () {
		var result = underTest();
		expect(path.dirname(result)).toEqual(tmpdir.normalize());
		expect(/^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}$/.test(path.basename(result))).toBeTruthy();
	});
	it('appends the extension if provided as an argument', function () {
		var result = underTest('.txt');
		expect(path.dirname(result)).toEqual(tmpdir.normalize());
		expect(/^[0-9a-z]{8}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{12}\.txt$/.test(path.basename(result))).toBeTruthy();
	});
	it('uses the provided string generator if supplied', function () {
		var generator = function () {
				return 'generated';
			},
			result = underTest('.txt', generator);

		expect(path.dirname(result)).toEqual(tmpdir.normalize());
		expect(path.basename(result)).toEqual('generated.txt');
	});
	it('keeps generating until if it generates an existing file path', function () {
		var names = ['not-needed', 'new', 'existing'],
			generator = function () {
				return names.pop();
			},
			result;
		fs.writeFileSync(path.join(os.tmpdir(), 'existing.txt'), 'Hello', 'utf8');
		result = underTest('.txt', generator);
		expect(path.basename(result)).toEqual('new.txt');
	});
});
