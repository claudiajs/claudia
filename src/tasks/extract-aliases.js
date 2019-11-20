module.exports = function extractAliases(awsAliasResult) {
	'use strict';
	const joinFields = (accumulator, current) => {
		const version = current.FunctionVersion,
			alias = current.Name;
		if (!accumulator[version]) {
			accumulator[version] = [];
		}
		accumulator[version].push(alias);
		return accumulator;
	};
	return awsAliasResult.Aliases.reduce(joinFields, {});
};
