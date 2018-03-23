# Claudia.js command line usage

Deploy a Node.JS project to AWS as a lambda microservice, optionally updating APIs/event hooks.

## Usage
```bash
claudia [command] {OPTIONS}
```

## Supported commands

* [`create`](create.md) Create the initial lambda function and related security role.
* [`update`](update.md) Deploy a new version of the Lambda function using project files, update any associated web APIs
* [`set-version`](set-version.md) Create or update a lambda alias/api stage to point to the latest deployed version
* [`add-s3-event-source`](add-s3-event-source.md) Add a notification event to Lambda when a file is added to a S3 bucket, and set up access permissions
* [`add-kinesis-event-source`](add-kinesis-event-source.md) Set up Kinesis Data Stream event triggers
* [`add-sns-event-source`](add-sns-event-source.md) Add a notification event to Lambda when a message is published on a SNS topic
* [`allow-alexa-skill-trigger`](allow-alexa-skill-trigger.md) Allow Alexa Skill triggers
* [`add-cognito-user-pool-trigger`](add-cognito-user-pool-trigger.md) Configures the Lambda to run on a Cognito User Pool trigger
* [`add-iot-topic-rule`](add-iot-topic-rule.md) Creates an IOT topic rule and configures the Lambda to run when a message is published on a matching IOT Gateway topic
* [`set-cloudfront-trigger`](set-cloudfront-trigger.md) Set up Lambda@Edge CloudFront behavior event triggers
* [`add-scheduled-event`](add-scheduled-event.md) Add a recurring notification event
* [`test-lambda`](test-lambda.md) Execute the lambda function and print out the response
* [`destroy`](destroy.md) Undeploy the lambda function and destroy the API and security roles
* [`generate-serverless-express-proxy`](generate-serverless-express-proxy.md) Create a lambda proxy API wrapper for an express app using aws-serverless-express
* [`generate`](generate.md) Create a lambda project template that you can immediately deploy
* [`tag`](tag.md) Add tags (key-value pairs) to a lambda function

## Options:

 * --help           print this help screen
 * --version        print out the current version
 * --quiet          suppress output when executing commands
 * --profile		set AWS credentials profile
 * --aws-client-timeout The number of milliseconds to wait before connection time out on AWS SDK Client. Defaults to two minutes (120000)
 * --proxy			set HTTP proxy for AWS commands

Run with a command name to see options of a specific command, for example:
```bash
claudia create --help
```
