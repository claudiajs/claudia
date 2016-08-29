# Developing and contributing to Claudia 

AWS Lambda currently supports Node.js 4.3.2 and 0.10.36. The support for 0.10 is going away in October 2016. Until then, please run all tests using both versions before submitting a pull request. You can use [nvm](https://github.com/creationix/nvm) to manage multiple versions of Node on your development environment.

One important downside of 0.10 support is lack of support for promises. Newer Node.js versions support promises out of the box, but Claudia has to use an external dependency for that. To support future migration to the standard API easier, please use the [bluebird](http://bluebirdjs.com/docs/api-reference.html) promise library. Once Node 0.10 is no longer supported in Lambda, we'll drop the external library and migrate to internal Promises. 

# Folder structure

The main body of code is in the [src](./src) directory. Any JS files in the [commands](./src/commands) subdir are automatically loaded as options for the command-line utility. Commands can expect to get a key-value set of options entered from the command line, and need to return a promise for the execution result. If you add or modify a command, please also update the [usage guide](docs). 

Sub-tasks directly related to automating and aggregating AWS workflows should go to the [tasks](./src/tasks) directory, and generic reusable utility functions should go to the [util](./src/util) directory.

Claudia has extensive unit and integration tests in the [spec](./spec) directory. Ideally, any new code should also be accompanied by a new test, so we can simplify future maintenance and development.  Unless there is a very compelling reason to use something different, please continue using [Jasmine](https://jasmine.github.io) for tests.

# Important tests to add

In addition for the tests for the new functionality, if you are adding any configuration arguments or changing any configuration options for API deploument, make sure to add a test to the [validatePackage spec](https://github.com/claudiajs/claudia/blob/master/spec/validate-package-spec.js) to ensure stupid mistakes are stopped before the API even starts deploying. Think of the most common ways users can mistakenly configure the new arguments (such as duplicates, empty values, inconsistent related settings) and provide a helpful error message in [validatePackage](https://github.com/claudiajs/claudia/blob/master/src/tasks/validate-package.js).

It might also be useful to add a successful fully configured example to the [kitchen sink parsing test](https://github.com/claudiajs/claudia/blob/master/spec/test-projects/api-gw-validation-kitchen-sink/main.js), which is just a smoke test to validate that correct configurations pass validation

# Running tests

## Setting credentials for tests

See the [Getting Started](getting_started.md) guide for information on how to set up the credentials to run tests. In addition to the ideas there, to allow you to separate out a testing profile from normal operation profiles, you can store additional environment variables or override existing environment values by creating a
`.env` file in the project root. (This file is ignored by `.gitignore`, so you don't have to worry about uploading it by mistake.) If that file exists, it will be loaded into the environment at the start of a test run.

The easiest way to manage a separate testing profile is probably to define the actual keys in your main `.aws/config` file, and use just the `AWS_PROFILE` key in the `.env` file, like this:

````
AWS_PROFILE=claudia-test
````

## Running tests

Run all the test, show a summary of the results:

````
npm test
````

Run the tests, and show individual test names

````
npm test -- full
````

Run only a selected set of tests, filtering by name:

````
npm test -- filter=prefix
````
