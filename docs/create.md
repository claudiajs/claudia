#create

usage: `claudia create {OPTIONS}`

Create the initial lambda function and related security role.

## _OPTIONS_ are:

*  `--name` lambda function name
  _For example_: awesome-microservice
*  `--region` AWS region where to create the lambda
  _For example_: us-east-1
*  `--version` _[OPTIONAL]_ A version alias to automatically assign to the new function
  _For example_: development
*  `--handler` _[OPTIONAL]_ Main function for Lambda to execute, as module.function
  _For example_: if it is in the main.js file and exported as router, this would be main.router
*  `--api-module` _[OPTIONAL]_ The main module to use when creating Web APIs. 
  If you provide this parameter, the handler option is ignored.
  This should be a module created using the Claudia API Builder.
  _For example_: if the api is defined in web.js, this would be web
*  `--source` _[OPTIONAL]_ Directory with project files
  _Defaults to_: current directory
*  `--config` _[OPTIONAL]_ Config file where the creation result will be saved
  _Defaults to_: claudia.json
*  `--policies` _[OPTIONAL]_ A directory or file pattern for additional IAM policies
  which will automatically be included into the security role for the function
  _For example_: policies/*.xml
*  `--role` _[OPTIONAL]_ The name of an existing role to assign to the function. 
  If not supplied, Claudia will create a new role
