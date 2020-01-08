# Claudia.js command line usage

Deploy a Node.JS project to AWS as a lambda microservice, optionally updating APIs/event hooks.

## Usage
```bash
claudia [command] {OPTIONS}
```

## Supported commands

* [`create`](create.md) Create the initial lambda function and related security role.
* [`update`](update.md) Deploy a new version of the Lambda function using project files, update any associated web APIs
* [`list`](list.md) List published versions of a function
* [`set-version`](set-version.md) Create or update a lambda alias/api stage to point to the latest deployed version
* [`pack`](pack.md) Package a zip file for uploading to Lambda with all the required NPM dependencies, without deploying it anywhere.
* [`add-cognito-user-pool-trigger`](add-cognito-user-pool-trigger.md) Configures the Lambda to run on a Cognito User Pool trigger
* [`add-iot-topic-rule`](add-iot-topic-rule.md) Creates an IOT topic rule and configures the Lambda to run when a message is published on a matching IOT Gateway topic
* [`add-kinesis-event-source`](add-kinesis-event-source.md) Set up Kinesis Data Stream event triggers
* [`add-s3-event-source`](add-s3-event-source.md) Add a notification event to Lambda when a file is added to a S3 bucket, and set up access permissions
* [`add-sns-event-source`](add-sns-event-source.md) Add a notification event to Lambda when a message is published on a SNS topic
* [`add-sqs-event-source`](add-sqs-event-source.md) Set up SQS event triggers
* [`allow-alexa-skill-trigger`](allow-alexa-skill-trigger.md) Allow Alexa Skill triggers
* [`set-cloudfront-trigger`](set-cloudfront-trigger.md) Set up Lambda@Edge CloudFront behavior event triggers
* [`add-scheduled-event`](add-scheduled-event.md) Add a recurring notification event
* [`test-lambda`](test-lambda.md) Execute the lambda function and print out the response
* [`destroy`](destroy.md) Undeploy the lambda function and destroy the API and security roles
* [`generate-serverless-express-proxy`](generate-serverless-express-proxy.md) Create a lambda proxy API wrapper for an express app using aws-serverless-express
* [`tag`](tag.md) Add tags (key-value pairs) to the lambda function and any associated web API

## Options:

 * --help               print this help screen
 * --version            print out the current version
 * --quiet              suppress output when executing commands
 * --profile            set AWS credentials profile
 * --sts-role-arn       set AWS STS Role for token-based authentication
 * --mfa-serial         set AWS MFA Serial Number (requires --sts-role-arn)
 * --mfa-token          set AWS MFA Token Code (requires --sts-role-arn)
 * --mfa-duration       set AWS MFA Duration in seconds (requires --sts-role-arn). Defaults to 3600
 * --aws-client-timeout The number of milliseconds to wait before connection time out on AWS SDK Client. Defaults to two minutes (120000)
 * --proxy              set HTTP proxy for AWS commands

Run with a command name to see options of a specific command, for example:
```bash
claudia create --help
```
