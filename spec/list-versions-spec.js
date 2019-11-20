const listVersions = require('../src/tasks/list-versions'),
	tmppath = require('../src/util/tmppath'),
	create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	aws = require('aws-sdk'),
	awsRegion = require('./util/test-aws-region'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	genericTestRole = require('./util/generic-role'),
	destroyObjects = require('./util/destroy-objects'),
	setVersion = require('../src/commands/set-version');
describe('listVersions', () => {
	'use strict';
	let workingdir, testRunName, lambda, newObjects;
	const extractVersionsAndAliases = a => a.map(i => ({version: i.version, aliases: i.aliases}));
	beforeEach(() => {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		lambda = new aws.Lambda({region: awsRegion});
		newObjects = {workingdir: workingdir};
		fs.mkdirSync(workingdir);
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('lists only latest when created without a version', (done) => {
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', role: genericTestRole.get()}).then(result => {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		})
		.then(() => listVersions(newObjects.lambdaFunction, lambda))
		.then(result => {
			expect(extractVersionsAndAliases(result)).toEqual([
				{ version: '$LATEST', aliases: ['latest']},
				{ version: '1', aliases: [] }
			]);
		})
		.then(done, done.fail);
	});
	it('includes runtime, size and time of creation', (done) => {
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', role: genericTestRole.get()}).then(result => {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		})
		.then(() => listVersions(newObjects.lambdaFunction, lambda))
		.then(result => {
			const item = result[0];
			expect(item.time).toBeTruthy();
			expect(item.runtime).toBeTruthy();
			expect(item.size).toBeTruthy();
		})
		.then(done, done.fail);

	});
	it('lists latest and specific version when created with a version', (done) => {
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		create({name: testRunName, region: awsRegion, version: 'dev', source: workingdir, handler: 'main.handler', role: genericTestRole.get()}).then(result => {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		})
		.then(() => listVersions(newObjects.lambdaFunction, lambda))
		.then(result => {
			expect(extractVersionsAndAliases(result)).toEqual([
				{ version: '$LATEST', aliases: ['latest']},
				{ version: '1', aliases: ['dev'] }
			]);
		})
		.then(done, done.fail);
	});
	it('lists multiple aliases assigned to the same version', (done) => {
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		create({name: testRunName, region: awsRegion, version: 'dev', source: workingdir, handler: 'main.handler', role: genericTestRole.get()}).then(result => {
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		})
		.then(() => setVersion({source: workingdir, version: 'new'}))
		.then(() => listVersions(newObjects.lambdaFunction, lambda))
		.then(result => {
			expect(extractVersionsAndAliases(result)).toEqual([
				{ version: '$LATEST', aliases: ['latest']},
				{ version: '1', aliases: ['dev', 'new'] }
			]);
		})
		.then(done, done.fail);

	});

	describe('filtering', () => {
		beforeEach((done) => {
			fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
			create({name: testRunName, region: awsRegion, version: 'dev', source: workingdir, handler: 'main.handler', role: genericTestRole.get()}).then(result => {
				newObjects.lambdaFunction = result.lambda && result.lambda.name;
			})
			.then(() => update({source: workingdir, version: 'new'}))
			.then(() => setVersion({source: workingdir, version: 'test'}))
			.then(() => update({source: workingdir, version: 'dev'}))
			.then(done, done.fail);
		});
		it('lists everything without a filter', (done) => {
			listVersions(newObjects.lambdaFunction, lambda)
			.then(result => {
				expect(extractVersionsAndAliases(result)).toEqual([
					{ version: '$LATEST', aliases: ['latest']},
					{ version: '1', aliases: [] },
					{ version: '2', aliases: ['new', 'test']},
					{ version: '3', aliases: ['dev']}
				]);
			})
			.then(done, done.fail);
		});
		it('filters versions by number', (done) => {
			listVersions(newObjects.lambdaFunction, lambda, 1)
			.then(result => {
				expect(extractVersionsAndAliases(result)).toEqual([
					{ version: '1', aliases: [] }
				]);
			})
			.then(done, done.fail);
		});
		it('filters versions by string number', (done) => {
			listVersions(newObjects.lambdaFunction, lambda, '3')
			.then(result => {
				expect(extractVersionsAndAliases(result)).toEqual([
					{ version: '3', aliases: ['dev'] }
				]);
			})
			.then(done, done.fail);
		});
		it('lists matching single alias', (done) => {
			listVersions(newObjects.lambdaFunction, lambda, 'dev')
			.then(result => {
				expect(extractVersionsAndAliases(result)).toEqual([
					{ version: '3', aliases: ['dev'] }
				]);
			})
			.then(done, done.fail);
		});
		it('lists matching any alias', (done) => {
			listVersions(newObjects.lambdaFunction, lambda, 'test')
			.then(result => {
				expect(extractVersionsAndAliases(result)).toEqual([
					{ version: '2', aliases: ['new', 'test'] }
				]);
			})
			.then(done, done.fail);
		});
	});


});
