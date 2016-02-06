# Getting started

## Node.JS version

AWS Lambda currently runs on Node.js 0.10.32. To avoid nasty surprises, we strongly suggest using that version for development. You can use [nvm](https://github.com/creationix/nvm) to manage multiple versions of Node on your development environment

## Configuring access credentials

Claudia uses the Node.js API for AWS. To set the credentials, please follow the instructions in [Setting AWS Credentials for NodeJS](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) section of the AWS API guide. 

Although any approach described in the guide will work, we recommend creating a separate profile with write-access to Lambda, API Gateway, IAM and other resources, and selecting that profile by setting the `AWS_PROFILE` environment variable.

## Project structure

Claudia expects the standard NPM `package.json` file, and requires the resources you want to deploy to be included in the `files` property. See the [files section of the NPM configuration guide](https://docs.npmjs.com/files/package.json#files) for more information. This is to avoid deploying test and development resources and local configuration files. 

Although the AWS Node.js deployment guide requires including the `node_modules` folder for deployment, don't add it to the `files` section. Claudia will do that
automatically for you. Even better, while preparing a package, Claudia will copy all the relevant files to a temporary project and install production dependencies only, so you are sure to deploy only the relevant module files. 

If you need to do any post-processing or validation before deployment, you can do that in the NPM `post-install` lifecycle task. Because Claudia runs `npm install` to fetch the dependencies, the post-install task will kick-off directly after the dependencies are downloaded, and before the package is uploaded to AWS.

## Creating new AWS resources

If you have a Node.js project that you'd like to deploy as a Lambda function, just run:

````
claudia create --name LAMBDA_NAME --region AWS_REGION
````

This will automatically create the required AWS resources, upload an initial version of your code, and save the configuration into the `claudia.json` configuration 
file so that you can update the resources easily in the future.

See the [Command Line Reference](../bin/usage.txt) for more options.

## Working with pre-existing lambda/API gateway resources

Claudia can also work with objects you've already created in AWS. In order to connect correctly to the resources, you'll need to 
create a `claudia.json` file in the root directory of your Node.js project, and set the following parameters:

  * `lambda`: required, an object containing the following properties
    * `name`: lambda function name
    * `role`: primary IAM security role that is assumed by the lambda function
    * `region`: AWS region where the function is defined

#### Example configuration

````
{
  "lambda": {
    "name": "hello-world",
    "role": "hello-world-executor",
    "region": "us-east-1"
  }
}
````
