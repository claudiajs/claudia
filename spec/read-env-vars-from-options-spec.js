/*global describe, it, expect */
const readEnvVarsFromOptions = require('../src/util/read-env-vars-from-options'),
	fs = require('fs'),
	tmppath = require('../src/util/tmppath');

describe('readEnvVarsFromOptions', () => {
	'use strict';
	it('should return undefined if no set-env options are defined', () => {
		expect(readEnvVarsFromOptions()).toBeUndefined();
		expect(readEnvVarsFromOptions({})).toBeUndefined();
		expect(readEnvVarsFromOptions({ignoreMe: 'yes'})).toBeUndefined();
	});
	it('throws an error if both set-env and set-env-from-json are specified', () => {
		const envpath = tmppath(),
			vars = {
				'set-env': 'XPATH=/var/www,YPATH=/var/lib',
				'set-env-from-json': envpath
			};
		fs.writeFileSync(envpath, '{"a":"b"}', 'utf8');
		expect(() => readEnvVarsFromOptions(vars)).toThrow('Incompatible arguments: cannot specify both --set-env and --set-env-from-json');
	});
	it('throws an error when set-env-from-json is set but the file does not exist', () => {
		expect(() => {
			readEnvVarsFromOptions({
				'set-env-from-json': tmppath()
			});
		}).toThrowError(/no such file or directory/);
	});
	it('throws an error when set-env-from-json is set but not valid json', () => {
		const envpath = tmppath(),
			vars = {
				'set-env-from-json': envpath
			};
		fs.writeFileSync(envpath, '{{', 'utf8');
		expect(() => {
			readEnvVarsFromOptions(vars);
		}).toThrow(`${envpath} is not a valid JSON file`);
	});
	it('throws an error when set-env is set but not valid CSV', () => {
		const options = { 'set-env': 'XPATH,YPATH=/var/lib' };
		expect(() => readEnvVarsFromOptions(options)).toThrow('Cannot read variables from set-env, Invalid CSV element XPATH');
	});
	it('converts csv key-value pairs from set-env into variables', () => {
		expect(readEnvVarsFromOptions({ 'set-env': 'XPATH=/var/www,YPATH=/var/lib' })).toEqual({
			Variables: {
				'XPATH': '/var/www',
				'YPATH': '/var/lib'
			}
		});
	});
	it('converts a valid JSON file into variables from set-env-from-json', () => {
		const envpath = tmppath();
		fs.writeFileSync(envpath, JSON.stringify({ 'XPATH': '/var/www', 'YPATH': '/var/lib' }), 'utf8');
		expect(readEnvVarsFromOptions({ 'set-env-from-json': envpath })).toEqual({
			Variables: {
				'XPATH': '/var/www',
				'YPATH': '/var/lib'
			}
		});
	});
});
