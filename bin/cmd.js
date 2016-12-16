#!/usr/bin/env node
'use strict';
/* global process, __dirname, require, console */
var minimist = require('minimist'),
	shell = require('shelljs'),
	path = require('path'),
	readCommands = require('../src/util/read-commands'),
	ConsoleLogger = require('../src/util/console-logger'),
	docTxt = require('../src/util/doc-txt'),
	AWS = require('aws-sdk'),
	readArgs = function () {
		return minimist(process.argv.slice(2), {
			alias: { h: 'help', v: 'version' },
			string: ['source', 'name', 'region', 'profile'],
			boolean: ['quiet'],
			default: { 'source': shell.pwd().toString() }
		});
	},
	main = function () {
		var args = readArgs(),
			commands = readCommands(),
			command = args._ && args._.length && args._[0],
			logger = (!args.quiet) && new ConsoleLogger();
		if (args.version && !command) {
			console.log(require(path.join(__dirname, '..', 'package.json')).version);
			return;
		}
		if (command && !commands[command]) {
			console.error('unsupported command ' + command + '. re-run with --help for usage information');
			process.exit(1);
			return;
		}
		if (args.help) {
			if (command) {
				console.log(docTxt.commandDoc(commands[command]));
			} else {
				console.log(docTxt.index(commands));
			}
			return;
		}

		if (!command) {
			console.error('command not provided. re-run with --help for usage information');
			process.exit(1);
			return;
		}
		if (args.profile) {
			AWS.config.credentials = new AWS.SharedIniFileCredentials({profile: args.profile});
		}
		if (args['aws-client-timeout']) {
			AWS.config.httpOptions = { timeout: args['aws-client-timeout'] };
		}
		commands[command](args, logger).then(function (result) {
			if (result) {
				console.log(JSON.stringify(result, null, 2));
			}
			process.exit();
		}, function (e) {
			console.error(e);
			process.exit(1);
		});
	};
main();
