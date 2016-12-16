/*global require, __dirname */
var fs = require('fs'),
	path = require('path'),
	shell = require('shelljs'),
	readCommands = require('./read-commands'),
	commandDoc = function (command) {
		'use strict';
		var lines = [],
			indent = function (s, indent) {
				var result = [],
					filler = new Array(indent + 1).join(' ');
				if (Array.isArray(s)) {
					s.forEach(function (line) {
						result.push(filler + line.trim());
					});
				} else {
					result.push(filler + s);
				}
				return result;
			},
			pushLines = function (arr) {
				arr.forEach(function (line) {
					lines.push(line);
				});
			};
		lines.push('#' + command.command);
		lines.push('');
		lines.push(command.doc.description);
		lines.push('');
		lines.push('## Usage');
		lines.push('');
		lines.push('```bash');
		lines.push('claudia ' + command.command + ' {OPTIONS}');
		lines.push('```');
		lines.push('');
		lines.push('## Options');
		lines.push('');
		command.doc.args.forEach(function (argDoc) {
			var components = [], descLines;
			components.push('*  `--' + argDoc.argument + '`: ');
			if (argDoc.optional) {
				components.push('_optional_');
			}
			descLines = argDoc.description.split('\n');
			components.push(descLines.shift());
			lines.push(components.join(' '));
			if (descLines.length) {
				pushLines(indent(descLines, 2));
			}
			if (argDoc.example) {
				pushLines(indent('* _For example_: ' + argDoc.example, 2));
			}
			if (argDoc.default) {
				pushLines(indent('* _Defaults to_: ' + argDoc.default, 2));
			}
		});
		lines.push('');
		return lines.join('\n');
	},
	index = function (commands) {
		'use strict';
		var lines = [];
		lines.push('# Claudia.js command line usage');
		lines.push('');
		lines.push('Deploy a Node.JS project to AWS as a lambda microservice, optionally updating APIs/event hooks.');
		lines.push('');
		lines.push('## Usage');
		lines.push('```bash');
		lines.push('claudia [command] {OPTIONS}');
		lines.push('```');
		lines.push('');
		lines.push('## Supported commands');
		lines.push('');
		Object.keys(commands).map(function (key) {
			return commands[key];
		}).sort(function (cmd1, cmd2) {
			return cmd1.doc.priority - cmd2.doc.priority;
		}).forEach(function (command) {
			var components = [], descLines;
			components.push('* [`');
			components.push(command.command);
			components.push('`](');
			components.push(command.command);
			components.push('.md) ');
			descLines = command.doc.description.split('\n');
			components.push(descLines.shift());
			lines.push(components.join(''));
		});
		lines.push('');
		lines.push('## Options:');
		lines.push('');
		lines.push(' * --help           print this help screen');
		lines.push(' * --version        print out the current version');
		lines.push(' * --quiet          suppress output when executing commands');
		lines.push(' * --profile        set AWS credentials profile');
		lines.push(' * --aws-client-timeout The number of milliseconds to wait before connection time out on AWS SDK Client. Defaults to two minutes (120000)');
		lines.push('');
		lines.push('Run with a command name to see options of a specific command, for example:');
		lines.push('```bash');
		lines.push('claudia create --help');
		lines.push('```');
		lines.push('');
		return lines.join('\n');
	},
	main = function () {
		'use strict';
		var docsDir = path.join(__dirname, '../../docs'),
			commands = readCommands();
		shell.rm('-rf', docsDir);
		shell.mkdir(docsDir);
		fs.writeFileSync(path.join(docsDir, 'README.md'), index(commands), 'utf8');
		Object.keys(commands).map(function (key) {
			var command = commands[key];
			fs.writeFileSync(path.join(docsDir, command.command + '.md'), commandDoc(command), 'utf8');
		});
	};
main();
