# Claudia.JS - deploy cloud Node.JS microservices

Claudia helps you deploy and update Node.js microservices to Amazon Web Services easier. It automates and simplifies deployment workflows and error prone tasks, so you can focus on important problems and not have to worry about AWS service quirks. Here are some of the things it can do for you:

* Create or update a lambda function from Node.js projects easily. Just call `claudia create`, and Claudia will pack up and post-process your code, grab all the dependencies, clean up irrelevant resources, upload to Lambda, and automatically handle process quirks such as retrying while IAM roles are propagating to Lambda. It will also configure the lambda function with commonly useful roles, such as allowing piping console.log to CloudWatch.
* Configure, version and deploy a Lambda function and the related Rest APIs endpoints as single operation, to avoid downtime and inconsistencies.
* Add event sources with correct privileges easier, to manage execution routing for different lambda versions, so you can have a single lambda resource and use different versions for development, staging/testing and production.
* Run multiple Rest API operations from a single Node.js project easily, to simplify and speed up coding and deployment, and avoid inconsistencies.
* Automatically create and configure REST API endpoints, input and output templates and processing to support common web API usage scenarios, such as CORS, query string and form parameters, text responses, HTTP header error codes and more...

## Examples, please!

A single `claudia create` command can replace [120 lines of shell scripts](https://github.com/gojko/nodejs-aws-microservice-examples/blob/master/web-parameter-processing/setup.sh) and all the associated template files required to correctly deploy and set up a API Gateway REST API and an associated Lambda function.

For some nice examples, see the [Example Projects](https://github.com/claudiajs/example-projects)

## Why?

AWS Lambda and API Gateway are built with great flexibility to support fantastically powerful operations, but they can be tedious to set up, especially for simple scenarios. The basic runtime is oriented towards executing Java code, so running Node.js functions requires ironing out quite a few quirks that aren't exactly well documented. Claudia is essentially a bunch of checklists and troubleshooting tips we've collected while developing microservices designed to run in AWS, automated behind a convenient API. 

## Getting started 

Please read the [getting started guide](getting_started.md).

## Contributing

Contributions are greatly appreciated. See the [contributors' guide](contributing.md) for information on running and testing code.



