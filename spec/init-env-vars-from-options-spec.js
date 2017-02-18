/*global describe, it, expect, jasmine, beforeEach */
const initEnvVarsFromOptions = require('../src/util/init-env-vars-from-options');

describe('initEnvVarsFromOptions', () => {
	'use strict';
	let oldEnv;
	const cloneEnv = function () {
		return JSON.parse(JSON.stringify(process.env));
	};
	beforeEach(() => {
		oldEnv = cloneEnv();
	});
	it('should resolve with undefined if no options are defined', done => {
		initEnvVarsFromOptions()
			.then((result) => {
				expect(result).toBeUndefined();
				expect(cloneEnv()).toEqual(oldEnv);
			})
			.then(done, done.fail);
	});
	it('should resolve with undefined if empty options', done => {
		initEnvVarsFromOptions({})
			.then((result) => {
				expect(result).toBeUndefined();
				expect(cloneEnv()).toEqual(oldEnv);
			})
			.then(done, done.fail);
	});
	it('should resolve with undefined if options do not contain env', done => {
		initEnvVarsFromOptions({ignoreMe: 'yes'})
			.then((result) => {
				expect(result).toBeUndefined();
				expect(cloneEnv()).toEqual(oldEnv);
			})
			.then(done, done.fail);

	});
	it('throws an error when loading env vars fails', done => {
		initEnvVarsFromOptions({
			'set-env-from-json': '/non-existing-path'
		}).then(done.fail, reason => {
			expect(reason).toMatch(/no such file or directory/);
			expect(cloneEnv()).toEqual(oldEnv);
		}).then(done, done.fail);
	});
	it('resolves with key-value pairs from set-env and extends the process.env', done => {
		initEnvVarsFromOptions({ 'set-env': 'XPATH=/var/www,YPATH=/var/lib' })
			.then(result => {
				const newEnv = cloneEnv();
				expect(result).toEqual({
					Variables: {
						'XPATH': '/var/www',
						'YPATH': '/var/lib'
					}
				});
				expect(newEnv).toEqual(jasmine.objectContaining(oldEnv));
				expect(newEnv.XPATH).toEqual('/var/www');
				expect(newEnv.YPATH).toEqual('/var/lib');

			}).then(done, done.fail);
	});
});
