/*global console, require, cd, process, test, mkdir, cp, exec, rm, pwd, __dirname */
var uuid = require('uuid'),
	os = require('os'),
	path = require('path'),
	aws = require('aws-sdk'),
	fs = require('fs'),
	archiver = require('archiver'),
	Promise = require('bluebird'),
	PromisingIterator = require('./promising-iterator');
(function () {
	'use strict';
	var packageConfig,
	envConfig,
	currentDir,
	targetDir,
	awsRegion = function () {
		return envConfig.region || 'us-east-1';
	},
	die = function (message, exc) {
		if (typeof (message) === 'object') {
			exc = message.error;
			message = message.stage;
		}
		console.log(message);
		if (exc) {
			console.log(exc.stack || exc.message || exc);
		}
		if (currentDir) {
			cd(currentDir);
		}
		process.exit(1);
	},
	loadTemplate = function (templateName, replacements) {
		var templateFile = path.join(__dirname || '', 'templates', templateName + '.json'),
		readFile = Promise.promisify(fs.readFile);
		return readFile(templateFile, {encoding: 'utf-8'}).then(function (content) {
			if (replacements) {
				Object.keys(replacements).forEach(function (replaceKey) {
					content = content.replace('%%' + replaceKey + '%%', replacements[replaceKey]);
				});
			}
			return Promise.resolve(content);
		});
	},
	debug = function (msg, arg) {
		console.log(msg, arg || '');
	},
	tempPath = function (ext) {
		var result;
		ext = ext || '';
		while (!result || test('-e', result))  {
			result = path.join(os.tmpdir(), uuid.v4() + ext);
		}
		return result;
	},
	readJSON = function (file) {
		var result;
		try {
			result = JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));
		} catch (e) {
			die('could not load ' + file, e);
			process.exit(1);
		}
		return result;
	},
	copyFiles = function () {
		var files;
		if (!packageConfig || !packageConfig.files) {
			die('package.json does not contain a files attribute');
		}
		files = ['package.json'].concat(packageConfig.files);
		debug('copying ', files);
		debug('target dir =', targetDir);

		mkdir('-p', targetDir);
		files.forEach(function (file) {
			debug('copying', file);
			cp('-R', file, targetDir);
		});
	},
	fetchNPMDependencies = function () {
		debug('running npm install');
		if (exec('npm install --production').code !== 0) {
			die('npm install failed');
		}
	},
	toPromise = function (api, methodName) {
		return function (params) {
			return new Promise(function (resolve, reject) {
				if (!api[methodName]) {
					console.log(methodName, 'missing');
					return reject();
				}
				console.log(methodName, params);
				api[methodName](params, function (err, data) {
					if (err) {
						return reject(err);
					}
					resolve(data);
				});
			});
		};
	},
	zipCurrentDir = function () {
		var targetFile = tempPath('.zip'),
		archive = archiver.create('zip', {}),
		zipStream = fs.createWriteStream(targetFile);
		return new Promise(function (resolve, reject) {
			debug('zipping into', targetFile);
			zipStream.on('close', function () {
				debug('zipped into', targetFile);
				resolve(targetFile);
			});
			archive.pipe(zipStream);
			archive.bulk([
					{
						expand: true,
						src: ['**/*'],
						dot: true
					}
			]);
			archive.on('error', function (e) {
				reject({stage: 'archiving failed', error: e});
			});
			archive.finalize();
		});
	},
	cleanUp = function () {
		rm ('-rf', targetDir);
		cd (currentDir);
		process.exit();
	},
	pushToS3 = function (filePath) {
		var key = path.basename(filePath),
		params = {
			Bucket: envConfig.deploymentBucket,
			Key: key,
			Body: fs.createReadStream(filePath)
		};
		debug('uploading to s3:', envConfig.deploymentBucket);
		return new Promise(function (resolve, reject) {
			(new aws.S3()).upload(params, function (err /*, data*/) {
				if (err) {
					return reject({stage: 's3 upload failed', error: err});
				}
				resolve(key);
			});
		});
	},
	updateLambda = function (s3Key) {
		var lambda = new aws.Lambda(),
			getFunctionConfiguration = toPromise(lambda, 'getFunctionConfiguration'),
			updateFunctionCode = toPromise(lambda, 'updateFunctionCode'),
			functionName = function () {
				return envConfig.lambdaFunctionName;
			};
		return getFunctionConfiguration({FunctionName: functionName()}).
			then(function () {
				return updateFunctionCode({
					FunctionName: functionName(),
					Publish: true,
					S3Bucket: envConfig.deploymentBucket,
					S3Key: s3Key
				});
			});
	},
	complete = function (url) {
		console.log('DONE. Deployed', url);
		cleanUp();
	},
	packApp = function () {
		copyFiles();
		cd(targetDir);
		fetchNPMDependencies();
		return zipCurrentDir();
	},
	getStageVariables = function () {
		if (!envConfig.stageVariables) {
			return '';
		}
		return envConfig.stageVariables.map(function (varName) {
			return '\\"' + varName + '\\": \\"${stageVariables.' + varName + '}\\"';
		}).join(',');
	},
	formatParams = function (params) {
		if (!params || params.length === 0) {
			return '';
		}
		return params.map(function (varName) {
			return '\\"' + varName + '\\": \\"$input.params(\'' + varName + '\')\\"';
		}).join(',');
	},
	patchApi = function (lambdaF) {
		var apigw = new aws.APIGateway(),
			removeResourceIfExists = function (res) {
				if (!res.id) {
					return Promise.resolve();
				} else {
					return deleteResource({
						resourceId: res.id,
						restApiId: envConfig.restApiId
					});
				}
			},
			deleteResource = toPromise(apigw, 'deleteResource'),
			putMethodResponse = toPromise(apigw, 'putMethodResponse'),
			putMethodIntegration = toPromise(apigw, 'putIntegration'),
			putIntegrationResponse = toPromise(apigw, 'putIntegrationResponse'),
			createResource = toPromise(apigw, 'createResource'),
			putMethod = toPromise(apigw, 'putMethod'),
			getResources = toPromise(apigw, 'getResources'),
			createMethod = function (methodConfig) {
				var replacements = {
						RESOURCE_ID: methodConfig.resourceId,
						LAMBDA_URN: lambdaF.FunctionArn,
						LAMBDA_REGION: awsRegion(),
						STAGE_VARIABLES: getStageVariables(),
						INPUT_PARAMS: formatParams(methodConfig.params)
					},
					addMethodProps = function (ob) {
						ob.httpMethod = methodConfig.httpMethod;
						ob.resourceId = methodConfig.resourceId;
						ob.restApiId = envConfig.restApiId;
						return ob;
					},
					flattenStatusCodeMap = function (statusCodeMap) {
						return Object.keys(statusCodeMap).map(function (responseCode) {
							var fromTemplate = addMethodProps(statusCodeMap[responseCode]);
							fromTemplate.statusCode = responseCode;
							return fromTemplate;
						});
					};
				console.log('creating method', methodConfig);
				return loadTemplate(methodConfig.templateName, replacements).then(
					function setupMethod(methodContents) {
						var methodObject;
						try {
							methodObject = JSON.parse(methodContents);
						} catch (e) {
							return Promise.reject('problem parsing JSON', methodContents);
						}
						return putMethod(addMethodProps({
							authorizationType: methodObject.authorizationType,
							apiKeyRequired: methodObject.apiKeyRequired
						})).then(function () {
							var responseDefinitions = flattenStatusCodeMap(methodObject.methodResponses);
							return Promise.all(responseDefinitions.map(putMethodResponse));
						}).then(function () {
							var integrationDefinition = addMethodProps(methodObject.methodIntegration),
							integrationResponseList = flattenStatusCodeMap(integrationDefinition.integrationResponses);
							delete(integrationDefinition.integrationResponses);
							return putMethodIntegration(integrationDefinition).then(function () {
								return Promise.all(integrationResponseList.map(putIntegrationResponse));
							});
						});
					});
			},
			createResourceAndMethods = function (res) {
				return createResource({
					restApiId: envConfig.restApiId,
					parentId: res.rootId,
					pathPart: res.resourceName
				}).then(
					function (awsResource) {
						var methods = Object.keys(res.templates).map(function (methodName) {
							return {
								httpMethod: methodName,
								resourceId: awsResource.id,
								templateName: res.templates[methodName],
								params: res.params
							};
						});
						return (new PromisingIterator(methods, createMethod)).iterate();
					}
				);
			},
			processResource = function (resource) {
				return removeResourceIfExists(resource).then(function () {
					return createResourceAndMethods(resource);
				});
			},
			findByPath = function (resourceItems, path) {
				var result;
				resourceItems.forEach(function (item) {
					if (item.path === path) {
						result = item;
					}
				});
				return result;
			};
		return getResources({restApiId: envConfig.restApiId}).then(function (data) {
			var rootId, resourceRecords,
			toResourceRecord = function (methodName) {
				var object = findByPath(data.items, '/' + methodName) || {};
				object.rootId = rootId;
				object.templates = envConfig.methods[methodName];
				object.params = envConfig.params[methodName];
				object.resourceName = methodName;
				return object;
			};
			rootId = findByPath(data.items, '/').id;
			resourceRecords = (Object.keys(envConfig.methods)).map(toResourceRecord);
			return Promise.all(resourceRecords.map(processResource));
		});
	},
	updatePermissions = function (lambdaF) {
		var lambda = new aws.Lambda(),
			addPermission = toPromise(lambda, 'addPermission');
		return addPermission({
			Action: 'lambda:InvokeFunction',
			FunctionName: lambdaF.FunctionName,
			Principal: 'apigateway.amazonaws.com',
			SourceArn: 'arn:aws:execute-api:us-east-1:' + envConfig.apiOwnerId + ':' + envConfig.restApiId + '/*/*/*',
			StatementId:  envConfig.restApiId  + '-deployment-' + lambdaF.Version,
			Qualifier: lambdaF.Version
		}).then(function () {
			return Promise.resolve(lambdaF);
		});
	},
	createDeployment = function () {
		var apigw = new aws.APIGateway(),
			deploy = toPromise(apigw, 'createDeployment');
		return deploy({
			restApiId: envConfig.restApiId,
			stageName: envConfig.deploymentStage
		});
	};

	require('shelljs/global');
	currentDir = pwd();
	targetDir = tempPath();
	packageConfig = readJSON('package.json');
	envConfig = readJSON('env/dev.json');
	aws.config.update({region: awsRegion()});
	packApp().
		then(pushToS3).
		then(updateLambda).
		then(updatePermissions).
		then(patchApi).
		then(createDeployment).
		then(complete)
		.catch(die);
})();
