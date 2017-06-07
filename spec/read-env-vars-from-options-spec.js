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
	[
		{ 'set-env': 'XPATH=/var/www,YPATH=/var/lib', 'set-env-from-json': tmppath() },
		{ 'set-env': 'XPATH=/var/www,YPATH=/var/lib', 'update-env-from-json': tmppath() },
		{ 'update-env': 'XPATH=/var/www,YPATH=/var/lib', 'update-env-from-json': tmppath() },
		{ 'update-env': 'XPATH=/var/www,YPATH=/var/lib', 'set-env-from-json': tmppath() },
		{ 'set-env': 'XPATH=/var/www,YPATH=/var/lib', 'update-env': 'XPATH=/var/www,YPATH=/var/lib' },
		{ 'set-env-from-json': tmppath(), 'update-env-from-json': tmppath() },
		{ 'update-env': 'XPATH=/var/www,YPATH=/var/lib', 'set-env-from-json': tmppath(), 'update-env-from-json': tmppath() }
	].forEach(testCase => {
		it('throws an error if multiple arguments used ' + Object.keys(testCase).join(','), () => {
			expect(() => readEnvVarsFromOptions(testCase)).toThrowError(/Incompatible arguments/);
		});
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
			'XPATH': '/var/www',
			'YPATH': '/var/lib'
		});
	});
	it('converts a valid JSON file into variables from set-env-from-json', () => {
		const envpath = tmppath();
		fs.writeFileSync(envpath, JSON.stringify({ 'XPATH': '/var/www', 'YPATH': '/var/lib' }), 'utf8');
		expect(readEnvVarsFromOptions({ 'set-env-from-json': envpath })).toEqual({
			'XPATH': '/var/www',
			'YPATH': '/var/lib'
		});
	});

	it('throws an error when update-env-from-json is set but the file does not exist', () => {
		expect(() => {
			readEnvVarsFromOptions({
				'update-env-from-json': tmppath()
			});
		}).toThrowError(/no such file or directory/);
	});
	it('throws an error when update-env-from-json is set but not valid json', () => {
		const envpath = tmppath(),
			vars = {
				'update-env-from-json': envpath
			};
		fs.writeFileSync(envpath, '{{', 'utf8');
		expect(() => {
			readEnvVarsFromOptions(vars);
		}).toThrow(`${envpath} is not a valid JSON file`);
	});
	it('throws an error when update-env is set but not valid CSV', () => {
		const options = { 'update-env': 'XPATH,YPATH=/var/lib' };
		expect(() => readEnvVarsFromOptions(options)).toThrow('Cannot read variables from update-env, Invalid CSV element XPATH');
	});
	it('converts csv key-value pairs from update-env into variables', () => {
		expect(readEnvVarsFromOptions({ 'update-env': 'XPATH=/var/www,YPATH=/var/lib' })).toEqual({
			'XPATH': '/var/www',
			'YPATH': '/var/lib'
		});
	});
	it('converts a valid JSON file into variables from update-env-from-json', () => {
		const envpath = tmppath();
		fs.writeFileSync(envpath, JSON.stringify({ 'XPATH': '/var/www', 'YPATH': '/var/lib' }), 'utf8');
		expect(readEnvVarsFromOptions({ 'update-env-from-json': envpath })).toEqual({
			'XPATH': '/var/www',
			'YPATH': '/var/lib'
		});
	});
});
