#create

Create the initial lambda function and related security role.

## Usage

```bash
claudia create {OPTIONS}
```

## _OPTIONS_ are:

*  `--name`:  lambda function name
  * _For example_: awesome-microservice
*  `--region`:  AWS region where to create the lambda
  * _For example_: us-east-1
*  `--version`:  _optional_ A version alias to automatically assign to the new function
  * _For example_: development
*  `--handler`:  _optional_ Main function for Lambda to execute, as module.function
  * _For example_: if it is in the main.js file and exported as router, this would be main.router
*  `--api-module`:  _optional_ The main module to use when creating Web APIs. 
  If you provide this parameter, the handler option is ignored.
  This should be a module created using the Claudia API Builder.
  * _For example_: if the api is defined in web.js, this would be web
*  `--source`:  _optional_ Directory with project files
  * _Defaults to_: current directory
*  `--config`:  _optional_ Config file where the creation result will be saved
  * _Defaults to_: claudia.json
*  `--policies`:  _optional_ A directory or file pattern for additional IAM policies
  which will automatically be included into the security role for the function
  * _For example_: policies/*.xml
*  `--role`:  _optional_ The name of an existing role to assign to the function. 
  If not supplied, Claudia will create a new role
