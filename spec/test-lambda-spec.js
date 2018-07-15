/*global describe, require, it, expect, beforeEach, afterEach */
const underTest = require('../src/commands/test-lambda'),
	destroyObjects = require('./util/destroy-objects'),
	create = require('../src/commands/create'),
	update = require('../src/commands/update'),
	tmppath = require('../src/util/tmppath'),
	fs = require('fs'),
	fsUtil = require('../src/util/fs-util'),
	path = require('path'),
	awsRegion = require('./util/test-aws-region');
describe('testLambda', () => {
	'use strict';
	let workingdir, testRunName, newObjects;
	beforeEach(() => {
		workingdir = tmppath();
		testRunName = 'test' + Date.now();
		newObjects = {workingdir: workingdir};
		fs.mkdirSync(workingdir);
	});
	afterEach(done => {
		destroyObjects(newObjects).then(done, done.fail);
	});
	it('fails when the source dir does not contain the project config file', done => {
		underTest({source: workingdir}).then(done.fail, reason => {
			expect(reason).toEqual('claudia.json does not exist in the source folder');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda name', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), '{}', 'utf8');
		underTest({source: workingdir}).then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.name missing from claudia.json');
			done();
		});
	});
	it('fails when the project config file does not contain the lambda region', done => {
		fs.writeFileSync(path.join(workingdir, 'claudia.json'), JSON.stringify({lambda: {name: 'xxx'}}), 'utf8');
		underTest({source: workingdir}).then(done.fail, reason => {
			expect(reason).toEqual('invalid configuration -- lambda.region missing from claudia.json');
			done();
		});
	});

	it('invokes a lambda function and returns the result', done => {
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
			return underTest({source: workingdir});
		}).then(result => {
			expect(result.StatusCode).toEqual(200);
			expect(result.Payload).toEqual('"hello world"');
			done();
		}, done.fail);
	});
	it('tests a specific version of the lambda function and returns the result', done => {
		fsUtil.copy('spec/test-projects/hello-world', workingdir, true);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler', version: 'original'}).then(result => {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(() => {
			fsUtil.copy('spec/test-projects/echo', workingdir, true);
			return update({source: workingdir, version: 'updated'});
		}).then(() => {
			return underTest({source: workingdir, version: 'original'});
		}).then(result => {
			expect(result.StatusCode).toEqual(200);
			expect(result.Payload).toEqual('"hello world"');
			done();
		}, done.fail);
	});
	it('invokes a lambda function with a payload', done => {
		const eventData = {
			who: 'me',
			sub: {name: 'good', val: 2}
		};
		fsUtil.copy('spec/test-projects/echo', workingdir, true);
		create({name: testRunName, region: awsRegion, source: workingdir, handler: 'main.handler'}).then(result => {
			newObjects.lambdaRole = result.lambda && result.lambda.role;
			newObjects.lambdaFunction = result.lambda && result.lambda.name;
		}).then(() => {
			const eventFile = path.join(workingdir, 'event.json');
			fs.writeFileSync(eventFile, JSON.stringify(eventData), 'utf8');
			return underTest({source: workingdir, event: eventFile});
		}).then(result => {
			expect(result.StatusCode).toEqual(200);
			expect(JSON.parse(result.Payload)).toEqual(eventData);
			done();
		}, done.fail);
	});
});
