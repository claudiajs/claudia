#create

Create the initial lambda function and related security role.

## Usage

```bash
claudia create {OPTIONS}
```

## Options

*  `--region`:  AWS region where to create the lambda
  * _For example_: us-east-1
*  `--handler`:  _optional_ Main function for Lambda to execute, as module.function
  * _For example_: if it is in the main.js file and exported as router, this would be main.router
*  `--api-module`:  _optional_ The main module to use when creating Web APIs. 
  If you provide this parameter, do not set the handler option.
  This should be a module created using the Claudia API Builder.
  * _For example_: if the api is defined in web.js, this would be web
*  `--deploy-proxy-api`:  _optional_ If specified, a proxy API will be created for the Lambda 
  function on API Gateway, and forward all requests to function.
  This is an alternative way to create web APIs to --api-module.
*  `--name`:  _optional_ lambda function name
  * _For example_: awesome-microservice
  * _Defaults to_: the project name from package.json
*  `--version`:  _optional_ A version alias to automatically assign to the new function
  * _For example_: development
*  `--source`:  _optional_ Directory with project files
  * _Defaults to_: current directory
*  `--config`:  _optional_ Config file where the creation result will be saved
  * _Defaults to_: claudia.json
*  `--policies`:  _optional_ A directory or file pattern for additional IAM policies
  which will automatically be included into the security role for the function
  * _For example_: policies/*.xml
*  `--allow-recursion`:  _optional_ Set up IAM permissions so a function can call itself recursively
*  `--role`:  _optional_ The name of an existing role to assign to the function. 
  If not supplied, Claudia will create a new role
*  `--runtime`:  _optional_ Node.js runtime to use. For supported values, see
  http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html
  * _Defaults to_: node4.3
*  `--description`:  _optional_ Textual description of the lambda function
  * _Defaults to_: the project description from package.json
*  `--memory`:  _optional_ The amount of memory, in MB, your Lambda function is given.
  The value must be a multiple of 64 MB.
  * _Defaults to_: 128
*  `--timeout`:  _optional_ The function execution time, in seconds, at which AWS Lambda should terminate the function
  * _Defaults to_: 3
*  `--no-optional-dependencies`:  _optional_ Do not upload optional dependencies to Lambda.
*  `--use-local-dependencies`:  _optional_ Do not install dependencies, use local node_modules directory instead
*  `--cache-api-config`:  _optional_ Name of the stage variable for storing the current API configuration signature.
  If set, it will also be used to check if the previously deployed configuration can be re-used and speed up deployment
  * _For example_: claudiaConfigCache
*  `--keep`:  _optional_ keep the produced package archive on disk for troubleshooting purposes.
  If not set, the temporary files will be removed after the Lambda function is successfully created
*  `--use-s3-bucket`:  _optional_ The name of a S3 bucket that Claudia will use to upload the function code before installing in Lambda.
  You can use this to upload large functions over slower connections more reliably, and to leave a binary artifact
  after uploads for auditing purposes. If not set, the archive will be uploaded directly to Lambda
  * _For example_: claudia-uploads
