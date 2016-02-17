# Claudia.js

Claudia helps you deploy and update Node.js microservices to Amazon Web Services easier. It automates and simplifies deployment workflows and error prone tasks, so you can focus on important problems and not have to worry about AWS service quirks. Here are some of the things it can do for you:

* Create or update a lambda function from Node.js projects easily. Just call `claudia create`, and Claudia will pack up and post-process your code, grab all the dependencies, clean up irrelevant resources, upload to Lambda, and automatically handle process quirks such as retrying while IAM roles are propagating to Lambda. It will also configure the lambda function with commonly useful roles, such as allowing piping console.log to CloudWatch.
* Configure, version and deploy a Lambda function and the related Rest APIs endpoints as single operation, to avoid downtime and inconsistencies.
* Add event sources with correct privileges easier, to manage execution routing for different lambda versions, so you can have a single lambda resource and use different versions for development, staging/testing and production.
* Run multiple Rest API operations from a single Node.js project easily, to simplify and speed up coding and deployment, and avoid inconsistencies.
* Automatically create and configure REST API endpoints, input and output templates and processing to support common web API usage scenarios, such as CORS, query string and form parameters, text responses, HTTP header error codes and more...

Claudia is a deployment utility, not a framework. It doesn't try to abstract away Amazon Web Services, but instead makes them easier to use in typical background processing and Web API scenarios from Javascript+Node.js.

## Examples, please!

A single `claudia create` command can replace [120 lines of shell scripts](https://github.com/gojko/nodejs-aws-microservice-examples/blob/master/web-parameter-processing/setup.sh) and all the associated template files required to correctly deploy and set up a API Gateway REST API and an associated Lambda function.

For some nice examples, see the [Example Projects](https://github.com/claudiajs/example-projects)

## Getting started 

Please read the [getting started guide](getting_started.md).

## Why?

AWS Lambda and API Gateway are built with great flexibility to support fantastically powerful operations, but they can be tedious to set up, especially for simple scenarios. The basic runtime is oriented towards executing Java code, so running Node.js functions requires ironing out quite a few quirks that aren't exactly well documented. Claudia is essentially a bunch of checklists and troubleshooting tips we've collected while developing microservices designed to run in AWS, automated behind a convenient API. 

## How does it compare to ...?

Claudia is just a smart deployer, and it doesn't try to be a big framework to control everything. You can organise your code any way you like, and unless you want to use the optional [API Builder](https://github.com/claudiajs/claudia-api-builder) to simplify web routing, there are no additional runtime dependencies for your project. Even the API Builder is structured to be minimal, standalone, and introduce no additional dependencies.

As opposed to [Apex](https://github.com/apex/apex) and similar deployers, Claudia has a much narrower scope. It works only for Node.js, but it does it really well. Generic frameworks support more runtimes, but leave the developers to deal with language-specific quirks. Because Claudia focuses on Node.js, it automatically installs templates to convert parameters and results into objects that Javascript can consume easily.

As opposed to [Serverless](https://github.com/serverless/serverless) and [Seneca](http://senecajs.org/), Claudia is not trying to change the way you structure or run projects. At the same time, those frameworks can help kick-start many standard tasks. Claudia does not have any project templates or plugins for that intentionally, so it can be simpler. One of our key design goals is not to introduce too much magic, and let people structure the code the way they want to.

As opposed to [Swagger](http://swagger.io/), Claudia has fewer features, but does simple stuff easier. Claudia doesn't require you to define APIs in separate interface files. There's no need to learn a special interface syntax, no need to keep your definition spread across multiple files and introduce the overhead of coordination and maintenance -- just [write the code](https://github.com/claudiajs/example-projects/blob/master/web-api/web.js) to handle requests. So, for example, Claudia can help you get started easily with a simple web API, but you won't be able to export it easily into iOS or Android SDKs. If you want to use a heavy interface-definition library you still can, and Claudia can deploy it, but for most of what we needed to do, that was a huge overkill. 

So, as a summary, if you want to build simple services and run them with AWS Lambda, and you're looking for something low-overhead,  easy to get started with, and you only want to use the Node.js runtime, Claudia is a good choice. If you want to export SDKs, need a fine-grained control over the distribution, allocation or discovery of services, need support for different runtimes and so on, use one of the alternative tools.

## Contributing

Contributions are greatly appreciated. See the [contributors' guide](contributing.md) for information on running and testing code.



