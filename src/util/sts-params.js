module.exports = function stsParams(commandArgs, ask) {
	'use strict';
	if (!commandArgs) {
		return false;
	}
	if (!commandArgs['sts-role-arn'] && !commandArgs['mfa-serial']) {
		return false;
	}
	const result = { params: {} },
		askForToken = (serial, callback) => {
			ask(`Please enter the code for MFA device ${serial}:`)
			.then(result => callback(null, result))
			.catch(callback);
		},
		fixedToken = (serial, callback) => {
			callback(null, commandArgs['mfa-token']);
		};

	if (commandArgs['sts-role-arn']) {
		result.params.RoleArn = commandArgs['sts-role-arn'];
	}
	if (commandArgs['mfa-serial']) {
		result.params.SerialNumber = commandArgs['mfa-serial'];
		if (commandArgs['mfa-duration']) {
			result.params.DurationSeconds = commandArgs['mfa-duration'];
		}
		if (commandArgs['mfa-token']) {
			result.tokenCodeFn = fixedToken;
		} else {
			result.tokenCodeFn = askForToken;
		}
	}
	return result;
};
