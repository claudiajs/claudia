# Release history

### 4.0.0 9 April 2018

- compatibility with Node.js 8.10 and NPM 5
- fix for package-lock.json and --no-optional-dependencies when using NPM 5
- Claudia now creates new functions using the node8.10 Lambda runtime by default 
- more resilient waiting on IAM propagation when patching existing roles for VPC access

### 3.4.0 23 March 2018

- added tag command to assist with Lambda tagging, thanks to [Mohamed Osama](https://github.com/oss92)

### 3.3.1 29 January 2018

- bugfix for CORS setup with path params
- enable generate-serverless-express to handle binary content

### 3.3.0 27 January 2018

- support for using server-side encryption for code uploads to s3, thanks to [Ricky Blaha](https://github.com/rickyblaha)

### 3.2.0 12 January 2018

- support for Kinesis Data Stream triggers with [`add-kinesis-event-source`](docs/add-kinesis-event-source.md)

### 3.1.0 11 January 2018

- support for request based custom API Gateway Authorisers

### 3.0.0 4 January 2018

- support for deploying to Lambda@Edge with [`set-cloudfront-trigger`](docs/set-cloudfront-trigger.md)
- support for generating quick start projects with [`generate`](docs/generate.md)
- support for configuring 3GB Lambda functions using `--memory`
- support for deploying custom [API Gateway Responses](https://github.com/claudiajs/claudia-api-builder/blob/master/docs/customise-responses.md#api-gateway-responses)
- speed up API GW deployments by using a single handler for CORS OPTIONS instead of replicating it for each supported route
- fix for deploying lambdas with a VPC configuration and manually specified roles

This release is fully backwards compatible with 2.0 in terms of client code, but changes internal protocols between claudia API Builder and claudia, which is why we increased the major version. For API and bot deployments, this release requires Claudia API Builder 3.0.

### 2.14.0 23 June 2017

- support for `allow-alexa-skill-trigger` (thanks to [Slobodan Stojanovic](https://github.com/stojanovic))

### 2.13.0, 7 June 2017 

- `update` and `set-version` can now patch existing environment variables without replacing the entire set. use `--update-env` or `--update-env-from-json`
- `update` can now reconfigure several commonly requested options: `--timeout`, `--memory`, `--runtime` and `--handler`

### 2.12.0, 26 April 2017

- support `--proxy` in claudia to specify a HTTP proxy when working behind corporate firewalls (thanks to [Jason Riddle](https://github.com/jason-riddle))
- isolate claudia filesystem additions better to avoid clashes with third party libraries that also change fs objects, such as Nuxt (thanks to [Paweł Barszcz](https://github.com/nkoder))

### 2.11.1, 24 April 2017 

- bugfix for `AliasAttributes` removal when creating cognito user pool triggers, thanks [@matsnow](https://github.com/matsnow)

### 2.11.0, 9 April 2017

- support for Cognito User Pool triggers (eg `claudia add-cognito-user-pool-trigger --user-pool-id POOLID --events PreSignUp`)
- bugfix for add-s3-event-source, when claudia was created with a role given as an ARN

### 2.10.0, 23 March 2017

- Use the new node6.10 runtime by default when creating functions. You can still use the older 4.3 runtime by supplying the --runtime flag

### 2.9.0, 20 Feb 2017

- Cognito Authorizers now finally work with Claudia Api Builder, thanks to [Andrew Gits](https://github.com/thekiwi), [Paul Korzhyk](https://github.com/paulftw) and [David Hooper](https://github.com/DavidHooper).

### 2.8.0, 19 Feb 2017

- support for triggering Lambda functions using IOT topic filters
- allows the same lambda version to bind multiple times to the same bucket (fix for https://github.com/claudiajs/claudia/issues/101)
- allow env variables set on the command line to be set when validating the package (fixes https://github.com/claudiajs/claudia/issues/96)
- bugfix: `claudia destroy` now uses `--profile` correctly (fix for https://github.com/claudiajs/claudia/issues/100) 

### 2.7.0, 11 Feb 2017

- support for `--suffix` when adding S3 event sourcs. (thanks to [Kamil Dybicz](https://github.com/kdybicz))

### 2.6.0, 17 January 2017

- support for API Gateway Binary content handling

### 2.5.0, 21 December 2016

- support for configuring VPC access using `--subnet-ids` and `--security-group-ids` (thanks to [Roy Reiss](https://github.com/royreiss))

### 2.4.0, 16 December 2016

- added --events option for customizing S3 event types (thanks to [Harry Gu](https://github.com/harrygu))
- allow setting AWS http client timeout with --aws-client-timeout (thanks to [Leonardo Nicolas](https://github.com/leonicolas))

### 2.3.0, 4 December 2016

- Allow CORS max-age to be set using API builder

### 2.2.0, 24 November 2016

- Set environment variables in create, update and set-version
- Pass a role ARN with create --role to deploy without any IAM access
- Remove claudia.json after destroying a function

### 2.1.6, 22 November 2016

- Lambda now supports loading Node modules from subdirectories, so Claudia no longer warns about it
- API Gateway post-deploy steps now get `apiCacheReused` in Lambda properties, set to `true` if API definition was reused from cache
- Claudia now uses native promises and promise support in AWS SDK instead of Bluebird
- Dependencies are shrinkwrapped to prevent problems with sub-dependencies breaking backwards compatibility

### 2.1.5, 11 November 2016

- downgrade shelljs to avoid bug that would silently cause some files not to be copied when using --local-dependencies
- bugfix for deployment from directories containing a space (https://github.com/claudiajs/claudia/issues/84)

### 2.1.4, 2.1.3, 9 November 2016

- force V4 signing for S3, to support european S3 operations
- bugfix for using scoped packages @company/name (https://github.com/claudiajs/claudia/issues/80), thanks to Nicolas Cochard
- bugfix for using local .npmrc files inside project folders (https://github.com/claudiajs/claudia/issues/81)
- prevent ambiguous definitions when handler specified without . or api module specified with function/extension

### 2.1.2, 4 November 2016

- bugfix for setting cache params and method params with API gateway.

### 2.1.1, 25 October 2016

- bugfix for setting Access-Control-Allow-Credentials header for CORS
- bugfix for `--no-optional-dependencies`, thanks to [jveres](https://github.com/jveres)
- bugfix for wildcards including files in package.json
- Claudia is now using NPM to package files, instead of directly copying individual files, so all NPM tricks and workflow events for packaging are directly supported

### 2.1.0, 5 October 2016

- support for `--generate-serverless-express-proxy`, helping users create aws-serverless-express wrappers.

### 2.0.0, 2.0.1, 2.0.2 27 September 2016 

- support for --deploy-proxy-api
- using AWS Proxy integration to support custom response codes and headers easier (will only work with claudia-api-builder 2.0.0)
- stopping support for node 0.10

### 1.9.0, 21 September 2016

- Reuse code easier across different functions: Claudia can now work working with local relative dependencies in package.json (referencing relative directories on your disk)
- Use Claudia easier in storage-restricted environments, such as cloud continuous integration: Temporary files produced for packaging are now cleaned up automatically after deployment. Specify --keep with `create` or `update` to keep the zip files around for troubleshooting (claudia will print out the location of the archive in that case). (A huge thanks to [Philipp Holly](https://github.com/phips28))
- Use Claudia easier with low bandwidth and larger functions, and keep binary packages on S3 for auditing purposes: supply a S3 bucket name with `--use-s3-bucket <bucket-name>` when using `claudia create` or `claudia update` and Claudia will send a binary archive to S3 then install it to Lambda from there, instead of uploading code directly to Lambda. It will also print out the uploaded file key in the command results, so you can easily integrate it with auditing tools. 

### 1.8.0, 7 September 2016

- support for `--no-optional-dependencies`, allowing you to exclude things like aws-sdk and imagemagick from the package uploaded to Lambda
- support for `--cache-api-config`, allowing faster deployments of web APIs and chat bots when the API configuration does not change

### 1.7.0, 26 August 2016

- support for custom authorizers defined by claudia-api-builder
- support for `--profile` to select a profile (this could be used instead of setting the AWS_PROFILE variable)
- better validation for authorization types and credentials requested by claudia API builder APIs

### 1.6.2, 18 August 2016

- `add-scheduled-event` no longer checks for role in `claudia.json`, it was not being used anyway

### 1.6.1, 18 August 2016

- bugfix for deployments under assumed roles/STS tokens

### 1.6.0, 2 August 2016

- API Gateway request support for `.normalizedHeaders`, containing a copy of the headers with lowercase header names, for easier processing
- API Gateway request support for `.rawBody`, containing the unparsed body in `application/json` requests, to allow for Facebook authentication and otherwise taking a hash of the raw body when needed. (thanks to [Fabricio C Zuardi](https://github.com/fczuardi))

### 1.5.0, 29 July 2016

- support for setting custom credentials and passing on caller credentials with IAM and STS (thanks to [Conor Dockry](https://github.com/cdock1029))
- bugfix that caused template mappings to fail if a header contained a quote

### 1.4.5, 22 July 2016

- support for `AWS_IAM` authorization type in API Gateway configuration (thanks to [Chris Bumgardner](https://github.com/cbumgard))

### 1.4.4, 12 July 2016

- support for `--allow-recursion` in create to automate IAM permissions for the function to call itself
- create and update will refuse to work when the source is the same as the Node temp folder, avoiding recursive disk fill-up

### 1.4.2, 23 June 2016

- Claudia can be forced to use local dependencies, instead of doing npm install, by `--use-local-dependencies`

### 1.4.0, 1.4.1 4 June 2016

- experimental support for postDeploy steps in Api Builder

### 1.3.1, 25 May 2016

- bugfix for working with non-reentrant dependency modules

### 1.3.0, 18 May 2016

- `create` and `update` now log command execution to avoid looking like claudia is stuck when deploying a large project. use `--quiet` to suppress output

### 1.2.8, 11 May 2016

- bugfix for using relative paths in `--source`

### 1.2.7, 11 May 2016

- bugfix for [#39](https://github.com/claudiajs/claudia/issues/39) -- when the files property is specified, `.gitignore` is not used

### 1.2.6, 9 May 2016

- support for `--memory` and `--timeout` in `create`

### 1.2.5, 27 April 2016

- bugfix/workaround for quoted POST and query string arguments, see https://forums.aws.amazon.com/thread.jspa?threadID=229672
- added cognito/authorizer fields to the context in API gateway, so they are available to the lambda function 

### 1.2.4, 23 April 2016

- lambda description set automatically from the package.json description, can be overridden by --description when creating

### 1.2.3, 18 April 2016

- form POST now also includes .body with raw input (so it can be posted back to paypal IPN)

### 1.2.2, 9 April 2016

- create, update and set-version now print out a web API URL if they create/update a web API

### 1.2.1, 9 April 2016

- it's no longer necessary to use `files` in `package.json` to deploy using Claudia. If the files property is not specified, Claudia will package everything apart from `node_modules`, typical VCS utility files (eg `.git`) and automatically exclude all patterns specified in `.gitignore` and `.npmignore`
- `--name` is now optional in `create`, by default Claudia will use the name from `package.json`

### 1.2.0, 9 April 2016

- Claudia now creates Node.js 4.3.2 deployments by default.
- Use --runtime when calling create to specify an alternative runtime (eg nodejs for the legacy 0.10)

### 1.1.2, 29 March 2016

- support for JSON result templates that contain a charset

### 1.1.1, 29 March 2016

- bugfix for application/xml POSTs

### 1.1.0, 29 March 2016 

- all validations are executed before any objects are created/updated, to avoid partially created functions
- web API handlers can now set custom headers (requires API Builder 1.1.0 or later). See the [Custom Headers Example Project](https://github.com/claudiajs/example-projects/blob/master/web-api-custom-headers/web.js)
- web API handlers can now set custom CORS origins, or completely disable CORS (requires API Builder 1.1.0 or later). See the [Custom CORS Example Project](https://github.com/claudiajs/example-projects/blob/master/web-api-custom-cors/web.js)
- web API now accepts text/plain content for POST, PUT and PATCH
- create and update prevent several common user errors and report more meaningfully on those
  - when the lambda handler can't be required (eg package dependency issue or syntax error)
  - when the API module does not export a Claudia API Builder-compatible interface (eg forgot to do module.exports)
  - when the API module does not contain any configured methods
  - when the API module does not contain the configured handler method
  - when the custom policies argument is specified but no files match it
  - when updating over a non-existent (eg removed) function or API definition
  - when working with an incompatible API version (eg claudia needs to be updated)

### 1.0.19, 25 March 2016

- retry TooManyRequestsException automatically, AWS SDK seems to have a recurring bug to not retry those 

### 1.0.18, 22 March 2016

- use --version to print current version
- test-lambda now accepts --version
- documentation re-structured so individual commands now print out options with --help
- markdown docs for the API on github

### 1.0.17, 21 March 2016

- bugfix to handle correctly POST operations with a charset (jQuery Ajax does this)

### 1.0.16, 16 March 2016

- utility destroy command for undeploying lambda and removing the API and associated roles. 

### 1.0.15, 11 March 2016

- support for apiKeyRequired option in the apiBuilder methods. See [Requiring Api Keys](https://github.com/claudiajs/claudia-api-builder#requiring-api-keys) for more information

### 1.0.14, 9 March 2016

- better error message when the `api-module` argument is not compatible with the `ApiBuilder` interface (eg people forget to export the api);

### 1.0.13, 8 March 2016

- support for text/xml requests

### 1.0.12

- scheduled events now support `--cron` shorthand argument for easier parsing on Windows

### 1.0.11

- scheduled events now support `--rate` shorthand argument for easier parsing on Windows

### 1.0.10, 4 March 2016

- Support for alternative config files (instead of claudia.json). just supply `--config FILE_NAME` to any command

### 1.0.9, 29 February 2016

- bugfix for empty FORM post parameters
