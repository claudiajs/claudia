# generate-serverless-express-proxy

Create a lambda proxy API wrapper for an express app using aws-serverless-express

## Usage

```bash
claudia generate-serverless-express-proxy {OPTIONS}
```

## Options

*  `--express-module`:  The main module that exports your express application
    * _For example_: if the application is defined and exported from express-server.js, this would be express-server
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--proxy-module-name`:  (_optional_) the name of the new proxy module/file that will be created. To create a file called web-lambda.js, this would be web-lambda
    * _Defaults to_: lambda
*  `--aws-serverless-express-module`:  (_optional_) the NPM module name/path of the serverless-express module you want to install
    * _Defaults to_: aws-serverless-express
