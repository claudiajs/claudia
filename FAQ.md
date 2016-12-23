# Frequently asked questions

## Why use Claudia, and not just deploy manually?

AWS Lambda and API Gateway are incredibly flexible, but they can be tedious to set up, especially for simple scenarios. The basic runtime is oriented towards executing Java code, so running Node.js functions requires you to iron out quite a few quirks, that aren't exactly well documented. 

Claudia automates all those steps for you, and uses the standard NPM packaging conventions, so you do not have to change your project layout. Just call `claudia create` and Claudia will pack up and post-process your code, grab all the dependencies, clean up irrelevant resources, upload to Lambda, set-up web APIs, and update version aliases. In addition, Claudia automatically configures the Lambda function for commonly useful tasks, allowing `console.log` to pipe to CloudWatch, helping you add event sources with correct IAM privileges and manage different versions for production, development and testing easily.

[Claudia API Builder](https://github.com/claudiajs/claudia-api-builder) helps you use API Gateway as if it were a typical JavaScript web server, so you do not have to learn Swagger or manage separate interface definition files. Claudia automatically sets up API Gateway resources the way JavaScript developers expect them to work, enabling CORS for all endpoints (so your users' browsers can call the APIs directly), making query string, form post and request headers directly available (instead of having to specify API Gateway models and templates), and routing errors to HTTP response code 500 (instead of the default 200 which breaks Promise-like request libraries).

## How does it compare to ...?

_Claudia is a deployment utility, not a framework._ It does not abstract away AWS services, but instead makes them easier to get started with. As opposed to [Serverless](https://github.com/serverless/serverless) and [Seneca](http://senecajs.org/), Claudia is not trying to change the way you structure or run projects. The optional [API Builder](https://github.com/claudiajs/claudia-api-builder), which simplifies web routing, is the only additional runtime dependency and it's structured to be minimal and standalone. Microservice frameworks have many nice plugins and extensions that can help kick-start standard tasks, but Claudia intentionally focuses only on deployment. One of our key design goals is not to introduce too much magic, and let people structure the code the way they want to.

_Claudia is focused on Node.js_. As opposed to [Apex](https://github.com/apex/apex) and similar deployers, Claudia has a much narrower scope. It works only for Node.js, but it does it really well. Generic frameworks support more runtimes, but leave the developers to deal with language-specific issues. Because Claudia focuses on Node.js, it automatically installs templates to convert parameters and results into objects that Javascript can consume easily, and makes things work the way Javascript developers expect out of the box.

_Claudia helps you get simple stuff done, quickly_. As opposed to defining APIs using [Swagger](http://swagger.io/), Claudia API builder has fewer features, but does simple stuff easier. Claudia configures many things you normally expect in an API by default (such as CORS support, routing errors to 500). Claudia doesn't require you to define APIs in separate interface files. There's no need to learn a special interface syntax, no need to keep your definition spread across multiple files and introduce the overhead of coordination and maintenance -- just [write the code](https://github.com/claudiajs/example-projects/blob/master/web-api/web.js) to handle requests. So, for example, Claudia can help you get started easily with a REST API, but you won't be able to export it easily into iOS or Android SDKs. If you want to use a heavy interface-definition library you still can, and Claudia can deploy it, but for most of what we needed to do, that was a huge overkill.

So, as a summary, if you want to build simple services and run them with AWS Lambda, and you're looking for something low-overhead,  easy to get started with, and you only want to use the Node.js runtime, Claudia is a good choice. If you want to export SDKs, need fine-grained control over the distribution, allocation or discovery of services, need support for different runtimes and so on, use one of the alternative tools.

## How to test locally?

Check out [Testing Locally](https://claudiajs.com/tutorials/testing-locally.html)

## What's new since...?

See the [Release History](RELEASES.md)
