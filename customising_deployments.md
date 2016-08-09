# Customising deployments

Claudia has lots of options to customise deployments. You can configure the function name, reserved memory, timeouts and a lot more by providing additional options to the `claudia create` command. To get a full list of supported options, check out the [Claudia Create Docs](https://github.com/claudiajs/claudia/blob/master/docs/create.md) or run:

```bash
claudia create --help
```
Check out these tutorials for information on customising deployments:

* [Selecting and excluding files from your package](https://claudiajs.com/tutorials/packaging.html)
* [Using local NPM modules](https://claudiajs.com/tutorials/packaging.html#local-modules)
* [Using different versions for development, testing and production](https://claudiajs.com/tutorials/versions.html)

## Working with API Gateway web APIs

Claudia can create an API Gateway definition, wire up integration templates and even simplify routing so that a single Lambda function can handle multiple web API URLs. For that, create a WEB API module using the [Claudia API Builder](https://github.com/claudiajs/claudia-api-builder) and supply the routing module name instead of a handler to create the project:

```bash
claudia create --name LAMBDA_NAME --region AWS_REGION --api-module ROUTING_MODULE
```

See the [Web Api Example Project](https://github.com/claudiajs/example-projects/tree/master/web-api) for a trivial example of how to wire up a single lambda to multiple HTTP paths.

## Working with pre-existing lambda/API gateway resources

Claudia can also work with objects you've already created in AWS. In order to connect correctly to the resources, you'll need to 
create a `claudia.json` file in the root directory of your Node.js project, and set the following parameters:

  * `lambda`: required, an object containing the following properties
    * `name`: lambda function name
    * `role`: primary IAM security role that is assumed by the lambda function
    * `region`: AWS region where the function is defined
  * `api`: (optional) API Gateway REST API details
    * `id`: REST API Id
    * `module`: the module that contains the API definition

#### Example configuration

````
{
  "lambda": {
    "name": "hello-world",
    "role": "hello-world-executor",
    "region": "us-east-1"
  },
  "api": {
    "id": "25628xa",
    "module": "web"
  }
}
````


