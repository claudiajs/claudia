module.exports = function appendServiceToRole(roleText, service) {
	'use strict';
	const jsonRole = JSON.parse(roleText),
		allowStatement = {Effect: 'Allow', Principal: {Service: service}, Action: 'sts:AssumeRole'},
		matchesService = function (statement) {
			return statement.Principal.Service === service ||
			(Array.isArray(statement.Principal.Service) && statement.Principal.Service.indexOf(service) >= 0);
		},
		matchesStatement = function (statement) {
			return statement.Effect === allowStatement.Effect
				&& statement.Action ===  allowStatement.Action
				&& matchesService(statement, service);
		};
	if (jsonRole.Statement.find(matchesStatement)) {
		return roleText;
	} else {
		jsonRole.Statement.push(allowStatement);
		return JSON.stringify(jsonRole);
	}
};
