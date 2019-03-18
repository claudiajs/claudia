const stsParams = require('../../src/util/sts-params');
describe('stsParams', () => {
	'use strict';
	it('returns falsy if neither mfa-serial or sts-role-arn are passed', () => {
		expect(stsParams({'mfa-token': 'xxxx'})).toBeFalsy();
	});
	it('returns only the role arn if sts-role-arn is passed but no mfa-serial', () => {
		expect(stsParams({'sts-role-arn': 'rolearn'})).toEqual({params: {RoleArn: 'rolearn'}});
		expect(stsParams({'sts-role-arn': 'rolearn', 'mfa-token': 'xxxx'})).toEqual({params: {RoleArn: 'rolearn'}});
	});
	it('returns a fixed token function with serial if mfa-serial and mfa-token are provided', () => {
		const result = stsParams({'mfa-serial': 'serialnumber', 'mfa-token': 'xxxx'}),
			callback = jasmine.createSpy('callback');

		expect(result.params).toEqual({SerialNumber: 'serialnumber'});
		result.tokenCodeFn('serial', callback);
		expect(callback).toHaveBeenCalledWith(null, 'xxxx');
	});
	it('includes mfa-duration as DurationSeconds', () => {
		const result = stsParams({'mfa-serial': 'serialnumber', 'mfa-duration': 600});
		expect(result.params.DurationSeconds).toEqual(600);
	});
	it('returns a role with serial and mfa-token if both sts-role-arn and mfa-serial are defined', () => {
		const result = stsParams({'sts-role-arn': 'rolearn', 'mfa-serial': 'serialnumber', 'mfa-token': 'xxxx'}),
			callback = jasmine.createSpy('callback');

		expect(result.params).toEqual({RoleArn: 'rolearn', SerialNumber: 'serialnumber'});
		result.tokenCodeFn('serial', callback);
		expect(callback).toHaveBeenCalledWith(null, 'xxxx');

	});
	describe('if mfa-serial is set but no mfa-token', () => {
		let result, ask, askResolve, askReject;
		beforeEach(() => {
			ask = jasmine.createSpy().and.callFake(() => {
				return new Promise((resolve, reject) => {
					askResolve = resolve;
					askReject = reject;
				});
			});
			result = stsParams({'mfa-serial': 'serialnumber'}, ask);
		});
		it('asks the user for the token', (done) => {
			const callback = jasmine.createSpy('callback').and.callFake(() => {
				expect(ask).toHaveBeenCalledWith('Please enter the code for MFA device XXX-YYY:');
				done();
			});
			result.tokenCodeFn('XXX-YYY', callback);
			askResolve('x');
		});
		it('returns the token when ask resolves', (done) => {
			const callback = jasmine.createSpy('callback').and.callFake((err, token) => {
				expect(err).toBeFalsy();
				expect(token).toEqual('0123456');
				done();
			});
			result.tokenCodeFn('serial number', callback);
			askResolve('0123456');
		});
		it('returns error when ask rejects', (done) => {
			const callback = jasmine.createSpy('callback').and.callFake((err, token) => {
				expect(err).toEqual('boom!');
				expect(token).toBeFalsy();
				done();
			});
			result.tokenCodeFn('serial number', callback);
			askReject('boom!');
		});

	});
});
