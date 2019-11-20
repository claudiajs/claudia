const extractAliases = require('../src/tasks/extract-aliases');
describe('extractAliases', () => {
	'use strict';
	it('formats AWS Alias list into function:aliases', () => {
		const input = {
			'Aliases': [
				{
					'FunctionVersion': '56',
					'Name': 'dev'
				},
				{
					'FunctionVersion': '$LATEST',
					'Name': 'latest'
				},
				{
					'FunctionVersion': '55',
					'Name': 'prd'

				},
				{
					'FunctionVersion': '55',
					'Name': 'stg'
				}
			]
		};
		expect(extractAliases(input)).toEqual({
			'55': ['prd', 'stg'],
			'56': ['dev'],
			'$LATEST': ['latest']
		});
	});
});
