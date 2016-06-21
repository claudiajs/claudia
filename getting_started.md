# Getting started

This document explains how to deploy a simple Node.js microservice to AWS Lambda using Claudia.js. For an example of how to set up a simple web API, check out [Getting Started with Claudia API Builder](https://github.com/claudiajs/claudia-api-builder/blob/master/docs/getting_started.md).

## Prerequisites

* AWS account with access to IAM and Lambda
* Node.js 4.3.2 or 0.10.36
* NPM

AWS Lambda currently supports Node.js 4.3.2 and 0.10.36. By default, Claudia will create 4.3.2 functions in Lambda, and you can force an older version with the `--runtime` argument while creating the function. To avoid nasty surprises, we strongly suggest using the same version for development and deployments. You can use [nvm](https://github.com/creationix/nvm) to manage multiple versions of Node on your development environment

### Configuring access credentials

Claudia uses the Node.js API for AWS. To set the credentials, please follow the instructions in [Setting AWS Credentials for NodeJS](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html) section of the AWS API guide. 

Although any approach described in the guide will work, we recommend creating a separate profile with write-access to Lambda, API Gateway, IAM and other resources, and selecting that profile by setting the `AWS_PROFILE` environment variable.


## Deploying your first AWS Lambda function

Create a new NPM project, and just give it a descriptive name (eg claudia-test):

```bash
mkdir claudia-test
cd claudia-test

npm init
```

Install Claudia.js as a global NPM utility:

```bash
npm install claudia -g
```

Now, create a simple JavaScript Lambda function -- for example, in a file called `lambda.js`. For detailed information on the Lambda API, check out the [Node.js Lambda Programming Model](http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html) on AWS.

```javascript
exports.handler = function (event, context) {
	'use strict';
	context.succeed('hello world');
};
```

Send this function to AWS using Claudia:

```bash
claudia create --region us-east-1 --handler lambda.handler
```

When the deployment completes, Claudia will save a new file `claudia.json` in your project directory, with the function details, so you can invoke and update it easily.

You can now invoke the Lambda function directly from the console:

```bash
claudia test-lambda
```

You should the following response:

```bash
{
  "StatusCode": 200,
  "Payload": "\"hello world\""
}
```

This means that the function was deployed to AWS, and is now ready to process events. For something more serious, you can connect this Lambda to various event sources, such as S3 file systems, SNS queues, CloudWatch log events, DynamoDB streams and so on.

For some nice examples of processing various event types, see the [Claudia Example Projects](https://github.com/claudiajs/example-projects)

## Updating an existing Lambda function

Let's make something a bit more dynamic. We'll send it a name, and expect a greeting in return. We'll also log the request using CloudWatch. Modify the `lambda.js` file:

```javascript
exports.handler = function (event, context) {
	console.log(event);
	context.succeed('hello ' + event.name);
};
```

Send the new version up to AWS:

```bash
claudia update
```

Now create a test event with the request data, for example in a file called `event.json`:

```javascript
{
  "name": "Tom"
}
```

Now invoke the Lambda function with the test event:

```bash
claudia test-lambda --event event.json
```

The response should come out with the name from the event:

```bash
{
  "StatusCode": 200,
  "Payload": "\"hello Tom\""
}
```

You can now check out your logs using [AWS Web Console](https://console.aws.amazon.com/cloudwatch/) or the AWS command-line tools:

```bash
aws logs filter-log-events --log-group-name /aws/lambda/claudia-test
```

Logging events is a good way to discover the right structure when you connect it to a new event source. 

Claudia has lots of options to customise deployments. Check out [Customising Deployments](customising_deployments.md) for more information on how to configure what gets sent to Lambda and how it gets used.
