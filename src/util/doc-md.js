const fs = require('fs'),
	path = require('path'),
	fsUtil = require('./fs-util'),
	readCommands = require('./read-commands'),
	commandDoc = function (command) {
		'use strict';
		const lines = [],
			indent = function (s, indent) {
				const result = [],
					filler = new Array(indent + 1).join(' ');
				if (Array.isArray(s)) {
					s.forEach(line =>  result.push(filler + line.trim()));
				} else {
					result.push(filler + s);
				}
				return result;
			},
			pushLines = function (arr) {
				arr.forEach(line => lines.push(line));
			};
		lines.push('# ' + command.command);
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
		command.doc.args.forEach(argDoc => {
			const components = [],
				descLines = argDoc.description.split('\n');
			components.push('*  `--' + argDoc.argument + '`: ');
			if (argDoc.optional) {
				components.push('(_optional_)');
			}
			components.push(descLines.shift());
			lines.push(components.join(' '));
			if (descLines.length) {
				pushLines(indent(descLines, 4));
			}
			if (argDoc.example) {
				pushLines(indent('* _For example_: ' + argDoc.example, 4));
			}
			if (argDoc.default) {
				pushLines(indent('* _Defaults to_: ' + argDoc.default, 4));
			}
		});
		lines.push('');
		return lines.join('\n');
	},
	index = function (commands) {
		'use strict';
		const lines = [];
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
		Object.keys(commands)
		.map(key => commands[key])
		.sort((cmd1, cmd2) => cmd1.doc.priority - cmd2.doc.priority)
		.forEach(command => {
			const components = [],
				descLines = command.doc.description.split('\n');
			components.push('* [`');
			components.push(command.command);
			components.push('`](');
			components.push(command.command);
			components.push('.md) ');
			components.push(descLines.shift());
			lines.push(components.join(''));
		});
		lines.push('');
		lines.push('## Options:');
		lines.push('');
		lines.push(' * --help           print this help screen');
		lines.push(' * --version        print out the current version');
		lines.push(' * --quiet          suppress output when executing commands');
		lines.push(' * --profile		set AWS credentials profile');
		lines.push(' * --aws-client-timeout The number of milliseconds to wait before connection time out on AWS SDK Client. Defaults to two minutes (120000)');
		lines.push(' * --proxy			set HTTP proxy for AWS commands');
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
		const docsDir = path.join(__dirname, '../../docs'),
			commands = readCommands();
		fsUtil.ensureCleanDir(docsDir);
		fs.writeFileSync(path.join(docsDir, 'README.md'), index(commands), 'utf8');
		Object.keys(commands).map(key => {
			const command = commands[key];
			fs.writeFileSync(path.join(docsDir, command.command + '.md'), commandDoc(command), 'utf8');
		});
	};
main();
