# Customising deployments

Claudia has lots of options to customise deployments. You can configure the function name, reserved memory, timeouts and a lot more by providing additional options to the `claudia create` command. To get a full list of supported options, check out the [Claudia Create Docs](https://github.com/claudiajs/claudia/blob/master/docs/create.md) or run:

```bash
claudia create --help
```

## Selecting and excluding files from your package

Claudia tries very hard to stay out of your way and let you define the projects the way you want to. If you do not want to use automatically generated API Gateway definitions, there are no special constraints or dependencies that you need to think about -- just follow the regular NPM packaging practices.

Claudia expects the standard NPM `package.json` file. You can use standard NPM packaging techniques to include or exclude files to your deployment.

  * all the standard patterns ignored by NPM are ignored by Claudia as well (including `.git`, `.hg` and so on)
  * if `.gitignore` or `.npmignore` exist, patterns listed in those files will be excluded
  * if the `package.json` file includes the `files` property, only those patterns will be included. See the [files section of the NPM configuration guide](https://docs.npmjs.com/files/package.json#files) for more information.
  
It's a good practice, although not necessary, to explicitly list the files or file patterns you want to deploy in the `files` property of `package.json`. This will ensure you avoid deploying test and development resources and local configuration files. You do not have to list `package.json` here, it will automatically be included.  

Although the AWS Node.js deployment guide requires including the `node_modules` folder for deployment, don't add it to the `files` section. Claudia will do that automatically for you. Even better, while preparing a package, Claudia will copy all the relevant files to a temporary project and install production dependencies only, so you are sure to deploy only the relevant module files. 

If you need to do any post-processing or validation before deployment, you can do that in the NPM `post-install` lifecycle task. Because Claudia runs `npm install` to fetch the dependencies, the post-install task will kick-off directly after the dependencies are downloaded, and before the package is uploaded to AWS.

### Using local NPM modules

By default, Claudia will not copy the local `node_modules`, but instead do a clean production installation in a temporary directory. This is to avoid copying testing and development dependencies, and also to validate as much as possible locally before sending the code to AWS. If you would like to skip that step, and use the local `node_modules`, supply `--use-local-dependencies` with your `create` or `update` command. 

This might be useful if you want to send up precompiled binaries for a different platform (eg you use Windows locally, but want to send compiled Linux binaries), or if you use local relative paths in your `package.json`.

## Working with API Gateway web APIs

Claudia can create an API Gateway definition, wire up integration templates and even simplify routing so that a single Lambda function can handle multiple web API URLs. For that, create a WEB API module using the [Claudia API Builder](https://github.com/claudiajs/claudia-api-builder) and supply the routing module name instead of a handler to create the project:

```bash
claudia create --name LAMBDA_NAME --region AWS_REGION --api-module ROUTING_MODULE
```

See the [Web Api Example Project](https://github.com/claudiajs/example-projects/tree/master/web-api) for a trivial example of how to wire up a single lambda to multiple HTTP paths.

## Using different versions for development, testing and production

Each time a Lambda function is deployed, it gets assigned a sequential deployment number. Event sources can be configured to publish events to a particular Lambda deployment number, or an alias (named pointer to a numeric version). This makes it easy to use a single Lambda function for development, production and testing environments. You can create a named alias by supplying `--version` to `claudia create` or `claudia update` and Claudia will automatically associate a named alias with the current deployment number. For example:

```bash
claudia update --version testing
```

You can also re-assign a named alias to the last deployed version quickly. This is useful, for example, after you have finished testing and want to promote the current deployment to production. Use: 

```bash
claudia set-version --version ALIAS_NAME
```

Claudia will automatically create a new alias for the currently deployed version, or re-assign an existing alias to it. The big difference between `set-version` and `update` is that `update` causes a new deployment from your local file system, and `set-version` uses the last deployed version. 

If your project includes an API Gateway definition, this will also create a new deployment of the web API, and create or re-assign an API Gateway stage, linking it directly to the Lambda alias. 

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


