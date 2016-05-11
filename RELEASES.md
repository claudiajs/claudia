# Release history

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
