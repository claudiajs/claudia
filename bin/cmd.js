#!/usr/bin/env node
const minimist = require('minimist'),
	path = require('path'),
	readCommands = require('../src/util/read-commands'),
	ConsoleLogger = require('../src/util/console-logger'),
	stsParams = require('../src/util/sts-params'),
	ask = require('../src/util/ask'),
	docTxt = require('../src/util/doc-txt'),
	AWS = require('aws-sdk'),
	HttpsProxyAgent = require('https-proxy-agent'),
	readArgs = function () {
		'use strict';
		return minimist(process.argv.slice(2), {
			alias: { h: 'help', v: 'version' },
			string: ['source', 'name', 'region', 'profile', 'mfa-serial', 'mfa-token'],
			boolean: ['quiet', 'force'],
			default: {
				'source': process.cwd(),
				'mfa-serial': process.env.AWS_MFA_SERIAL,
				'sts-role-arn': process.env.AWS_ROLE_ARN,
				'mfa-duration': (process.env.AWS_MFA_DURATION || 3600)
			}
		});
	},
	main = function () {
		'use strict';
		const args = readArgs(),
			commands = readCommands(),
			command = args._ && args._.length && args._[0],
			logger = (!args.quiet) && new ConsoleLogger(),
			stsConfig = stsParams(args, ask);
		if (args.version && !command) {
			console.log(require(path.join(__dirname, '..', 'package.json')).version);
			return;
		}
		if (command && !commands[command]) {
			console.error(`unsupported command ${command}. re-run with --help for usage information`);
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
			AWS.config.httpOptions = AWS.config.httpOptions || {};
			AWS.config.httpOptions.timeout = args['aws-client-timeout'];
		}

		if (args.proxy) {
			AWS.config.httpOptions = AWS.config.httpOptions || {};
			AWS.config.httpOptions.agent = new HttpsProxyAgent(args.proxy);
		}

		if (stsConfig) {
			AWS.config.credentials = new AWS.ChainableTemporaryCredentials(Object.assign(stsConfig, {masterCredentials: AWS.config.credentials}));
		}

		commands[command](args, logger).then(result => {
			if (result && !args.quiet) {
				if (typeof result === 'string') {
					console.log(result);
				} else {
					console.log(JSON.stringify(result, null, 2));
				}
			}
			process.exit();
		}, e => {
			console.error(e);
			process.exit(1);
		});
	};
main();
