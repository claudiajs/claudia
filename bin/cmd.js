#!/usr/bin/env node
const minimist = require('minimist'),
	path = require('path'),
	readCommands = require('../src/util/read-commands'),
	ConsoleLogger = require('../src/util/console-logger'),
	docTxt = require('../src/util/doc-txt'),
	AWS = require('aws-sdk'),
	HttpsProxyAgent = require('https-proxy-agent'),
	readArgs = function () {
		'use strict';
		return minimist(process.argv.slice(2), {
			alias: { h: 'help', v: 'version' },
			string: ['source', 'name', 'region', 'profile'],
			boolean: ['quiet', 'force'],
			default: { 'source': process.cwd() }
		});
	},
	tokenCodeFn = function (code) {
		'use strict';
		return function (mfaSerial, callback) {

			if (code) {
				return callback(null, String(code));
			}
			const readline = require('readline').createInterface({
				input: process.stdin,
				output: process.stdout
			});

			readline.question(`Please enter the code for MFA device ${mfaSerial}:`, (value) => {
				readline.close();
				return callback(null, String(value));
			});

		};
	},
	main = function () {
		'use strict';
		const args = readArgs(),
			commands = readCommands(),
			command = args._ && args._.length && args._[0],
			logger = (!args.quiet) && new ConsoleLogger(),
			RoleArn = process.env.AWS_ROLE_ARN || args['sts-role-arn'],
			SerialNumber = process.env.AWS_MFA_SERIAL || args['mfa-serial'],
			TemporaryCredentialsParams = { params: {RoleArn}};
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

		if (SerialNumber) {
			Object.assign(TemporaryCredentialsParams.params, {
				SerialNumber,
				DurationSeconds: process.env.AWS_MFA_DURATION || args['mfa-duration'] || 3600
			});
			Object.assign(TemporaryCredentialsParams, {tokenCodeFn: tokenCodeFn(args['mfa-token'])});
		}

		if (RoleArn) {
			console.log(`Assuming Role ${RoleArn}`);
			Object.assign(TemporaryCredentialsParams.params, {RoleArn});
		}

		if (SerialNumber || RoleArn) {
			AWS.config.credentials = new AWS.ChainableTemporaryCredentials(TemporaryCredentialsParams);
		}
		commands[command](args, logger).then(result => {
			if (result && !args.quiet) {
				console.log(JSON.stringify(result, null, 2));
			}
			process.exit();
		}, e => {
			console.error(e);
			process.exit(1);
		});
	};
main();
