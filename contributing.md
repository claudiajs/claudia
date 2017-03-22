# Guide for contributors

* **Would you like to ask a question or discuss feature ideas?** Let's chat in the [ClaudiaJS chat channel](https://gitter.im/claudiajs/claudia). Please don't add an issue to GitHub.
* **Not sure if something is a bug or the way it's supposed to work?** [Let's chat first](https://gitter.im/claudiajs/claudia), don't log an issue yet. 
* **Would you like to report a bug?** Please log an issue [directly in this github repository](https://github.com/claudiajs/claudia/issues).
* **Would you like to contribute code?** Lovely! Please submit a pull request. Check out the rest of this document for guidelines on where to add/change code before doing so.

## Submitting pull requests

First of all, thanks very much for spending the time to improve the code! The rest of this file will help you discover where to look for the code you want to change, where to put the changes and how to ensure that we can merge your pull request.

We try to merge pull requests as quickly as possible, so generally if you follow the guidelines outlined below, you can expect the request to be merged within a working day or two.

Please don't submit a pull request until the code is completely ready. To avoid pull requests becoming a graveyard for half-baked code, we will close all pull requests after a week of inactivity. This isn't a reflection on the quality of your ideas or coding skills, it's just a way to avoid maintenance hell.  

If you're planning to change lots of code, we would prefer if you submitted several smaller pull requests for independent changes, instead of one big batch with everything in it. Smaller changes are easier to validate and discuss, and it's easier to catch unintended changes with those. 

Please make sure your pull request includes only the changes necessary for your code. Don't submit the lines that have only formatting changes, unless this is required by the linter. Don't submit files that are not important for your particular change.

### Where to put new code, and where to find the existing code to change 

* The main code is in the [src](./src) directory, divided into three subdirectories:
  * Any JS files in the [commands](./src/commands) subdir are automatically loaded as options for the command-line utility. Commands can expect to get a key-value set of options entered from the command line, and need to return a promise for the execution result. 
  * Sub-tasks directly related to automating and aggregating AWS workflows should go to the [tasks](./src/tasks) directory
  * Generic reusable utility functions should go to the [util](./src/util) directory.
* Claudia has extensive unit and integration tests in the [spec](./spec) directory. These aren't organised by folders, so everything is in the same place.

### Before submitting the request

In order to make it easier for you and us to develop together and maintain the code easier, here's what would be ideal:

* Make sure the code is passing the style guide checks with `eslint`. You can run `npm run pretest` to execute the style guide checks
* Please supply automated tests for any new functionality you are adding to Claudia. With these in place, people who modify the same code in the future can easily ensure that they've not broken something that is important to you. 
* If you are adding or removing command line options, please change the documentation at the bottom of the appropriate command source file. The user documentation, command line help and web documentation gets automatically rebuilt from those. 
* If you are adding any configuration arguments or changing any configuration options for API deployment, please help us make Claudia easier to use by trying to validate the configuration for new features before deployment. Troubleshooting misconfigured deployed functions is very difficult with Lambda, so it's best if we can help users avoid stupid mistakes. Here is how you can do that:
  * Think of the most common ways users can mistakenly configure the new arguments (such as duplicates, empty values, inconsistent related settings) and provide a helpful error message in [validatePackage](https://github.com/claudiajs/claudia/blob/master/src/tasks/validate-package.js)
  * Make sure to add a test to the [validatePackage spec](https://github.com/claudiajs/claudia/blob/master/spec/validate-package-spec.js) to ensure stupid mistakes are stopped before the API even starts deploying.
  * It might also be useful to add a successful fully configured example to the [kitchen sink parsing test](https://github.com/claudiajs/claudia/blob/master/spec/test-projects/api-gw-validation-kitchen-sink/main.js), which is just a smoke test to validate that correct configurations pass validation.
* Please run at least the tests for your new code or the things you change before submitting a pull request. Full tests take about two hours, so you don't have to run everything, but make sure your code at least works. 

### Running tests

#### Setting credentials for tests

See the [Getting Started](getting_started.md) guide for information on how to set up the credentials to run tests. In addition to the ideas there, to allow you to separate out a testing profile from normal operation profiles, you can store additional environment variables or override existing environment values by creating a
`.env` file in the project root. (This file is ignored by `.gitignore`, so you don't have to worry about uploading it by mistake.) If that file exists, it will be loaded into the environment at the start of a test run.

The easiest way to manage a separate testing profile is probably to define the actual keys in your main `.aws/config` file, and use just the `AWS_PROFILE` key in the `.env` file, like this:

```
AWS_PROFILE=claudia-test
```

* To run all the tests, and show a summary of the results, use the following command: `npm test`
* To run all the tests, and show individual test names executed, use the following command: `npm test -- full`
* To run only a selected set of tests, filter them by name: `npm test -- filter=prefix` (note the space between the two dashes and the prefix). 

For example, if you have a spec starting with: 

```js
describe('Some new feature', function () {
  it('works well', function () {
  
  })
 })
 ```

You can run just that one test by executing `npm test -- filter="Some new feature works well"`, or execute all the tests in that same spec bloc by using `npm test -- filter="Some new feature"`

#### Change the remote operation timeout

By default, tests have 150 seconds to complete before timing out. You might want to change that depending on where you're executing the tests from and what AWS region you're running them in. Do so by changing the TEST_TIMEOUT environment variable before running the tests, and set it to a number of milliseconds. 

#### Managing environment variables for testing

You can create a `.env` file in the root project directory, and store key-value pairs of environment variables there. The test runner will load any variables from that file if it exists before running the tests. The file is ignored by git, so you can be sure that the test initialisation stays on your machine only. Here is an example file:

*.env*
```bash
AWS_PROFILE=claudia-test
AWS_REGION=us-east-1
TEST_TIMEOUT=300000
```

## General development/contribution policies

Here are same house rules for Claudia development. Breaking one of these doesn't necessarily mean that your pull request will not be merged, but following the rules will make it easier and faster to do that. If you decide to break one of these, please explain in the pull request why, so we can revise the rules or adjust the code together.

* AWS Lambda currently supports only Node.js 6.10 and 4.3.2, so we use that one as the baseline for Claudia development. You can use [nvm](https://github.com/creationix/nvm) to manage multiple versions of Node on your development environment if you need to.
* ES6 code is allowed and encouraged, as long as it works on 4.3.2. We don't use babel for transpilation. 
* We use [Jasmine](https://jasmine.github.io) for tests. 
* We use `eslint` for linting, with the style guide in [`.eslintrc`](https://github.com/claudiajs/claudia/blob/master/.eslintrc.json)
  * If a particular line of code needs to relax linting rules, use the `//eslint-disable-line` trick instead of disabling it for the whole file
* We use Github issues only for bugs. Everything else (questions/suggestions) should go to the [ClaudiaJS chat channel](https://gitter.im/claudiajs/claudia).
* We will close all incomplete pull requests after a week of inactivity.

