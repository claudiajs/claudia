/*global require, describe, it, expect, beforeEach, Promise, jasmine */
const updateEnvVars = require('../src/tasks/update-env-vars'),
	fs = require('fs'),
	tmppath = require('../src/util/tmppath');

describe('updateEnvVars', () => {
	'use strict';
	let fakeLambdaAPI;

	beforeEach(() => {
		fakeLambdaAPI = jasmine.createSpyObj('lambda', ['updateFunctionConfiguration']);
		fakeLambdaAPI.updateFunctionConfiguration.and.returnValue(
			{
				promise: () => {
					return Promise.resolve();
				}
			}
		);
	});
	it('does not invoke the lambda method if no env options are provided', done => {
		updateEnvVars({a: 'b'}, fakeLambdaAPI, 'MyFunc').then(() => {
			expect(fakeLambdaAPI.updateFunctionConfiguration).not.toHaveBeenCalled();
		}).then(done, done.fail);
	});
	it('sets only the KMS key if it is the only option', done => {
		updateEnvVars({a: 'b', 'env-kms-key-arn': 'A:B:C'}, fakeLambdaAPI, 'MyFunc').then(() => {
			expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
				FunctionName: 'MyFunc',
				KMSKeyArn: 'A:B:C'
			});
		}).then(done, done.fail);
	});
	describe('set-env', () => {
		it('sets the variables', done => {
			updateEnvVars({a: 'b', 'set-env': 'A=B,C=D'}, fakeLambdaAPI, 'MyFunc').then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							A: 'B',
							C: 'D'
						}
					}
				});
			}).then(done, done.fail);
		});
		it('ignores existing variables', done => {
			updateEnvVars({a: 'b', 'set-env': 'A=B,C=D'}, fakeLambdaAPI, 'MyFunc', {old: 'D'}).then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							A: 'B',
							C: 'D'
						}
					}
				});
			}).then(done, done.fail);
		});
	});
	describe('update-env', () => {
		it('merges with old variables', done => {
			updateEnvVars({a: 'b', 'update-env': 'A=B,C=D'}, fakeLambdaAPI, 'MyFunc', {A: 'OLD1', old: 'D2'}).then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							A: 'B',
							C: 'D',
							old: 'D2'
						}
					}
				});
			}).then(done, done.fail);
		});
		it('updates if no old variables', done => {
			updateEnvVars({a: 'b', 'update-env': 'A=B,C=D'}, fakeLambdaAPI, 'MyFunc').then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							A: 'B',
							C: 'D'
						}
					}
				});
			}).then(done, done.fail);
		});
	});
	describe('set-env-from-json', () => {

		it('sets the new variables', done => {
			const envpath = tmppath();
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/opt', 'ZPATH': '/usr'}), 'utf8');
			updateEnvVars({a: 'b', 'set-env-from-json': envpath}, fakeLambdaAPI, 'MyFunc').then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							XPATH: '/opt',
							ZPATH: '/usr'
						}
					}
				});
			}).then(done, done.fail);
		});
		it('ignores any existing variables', done => {
			const envpath = tmppath();
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/opt', 'ZPATH': '/usr'}, {'YPATH': '/xxx'}), 'utf8');
			updateEnvVars({a: 'b', 'set-env-from-json': envpath}, fakeLambdaAPI, 'MyFunc').then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							XPATH: '/opt',
							ZPATH: '/usr'
						}
					}
				});
			}).then(done, done.fail);
		});
	});
	describe('update-env-from-json', () => {
		it('works if no old variables', done => {
			const envpath = tmppath();
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/opt', 'ZPATH': '/usr'}), 'utf8');
			updateEnvVars({a: 'b', 'update-env-from-json': envpath}, fakeLambdaAPI, 'MyFunc').then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							XPATH: '/opt',
							ZPATH: '/usr'
						}
					}
				});
			}).then(done, done.fail);
		});
		it('merges with old variables', done => {
			const envpath = tmppath();
			fs.writeFileSync(envpath, JSON.stringify({'XPATH': '/opt', 'ZPATH': '/usr'}), 'utf8');
			updateEnvVars({a: 'b', 'update-env-from-json': envpath}, fakeLambdaAPI, 'MyFunc', {'XPATH': '/old', 'YPATH': '/xxx'}).then(() => {
				expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
					FunctionName: 'MyFunc',
					Environment: {
						Variables: {
							XPATH: '/opt',
							ZPATH: '/usr',
							YPATH: '/xxx'
						}
					}
				});
			}).then(done, done.fail);

		});

	});

	it('sets both KMS key and environment variables if provided together', done => {
		updateEnvVars({a: 'b', 'env-kms-key-arn': 'A:B:C',  'set-env': 'A=B,C=D'}, fakeLambdaAPI, 'MyFunc').then(() => {
			expect(fakeLambdaAPI.updateFunctionConfiguration).toHaveBeenCalledWith({
				FunctionName: 'MyFunc',
				KMSKeyArn: 'A:B:C',
				Environment: {
					Variables: {
						A: 'B',
						C: 'D'
					}
				}
			});
		}).then(done, done.fail);
	});
});
