#!/usr/bin/env node
/* global process, __dirname, require, console */
var minimist = require('minimist'),
	shell = require('shelljs'),
	path = require('path'),
	readCommands = require('../src/util/read-commands'),
	docTxt = require('../src/util/doc-txt'),
	readArgs = function () {
		'use strict';
		return minimist(process.argv.slice(2), {
			alias: { h: 'help', v: 'version' },
			string: ['source', 'name', 'region'],
			default: { 'source': shell.pwd() }
		});
	},
	main = function () {
		'use strict';
		var args = readArgs(),
			commands = readCommands(),
			command = args._ && args._.length && args._[0];
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

		commands[command](args).then(function (result) {
			if (result) {
				console.log(JSON.stringify(result));
			}
			process.exit();
		}, function (e) {
			console.error(e);
			process.exit(1);
		});
	};

main();
