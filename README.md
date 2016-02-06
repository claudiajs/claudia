BeamUp -- a simple Node.JS microservice deployer for AWS
========================================================



# Notes

To make this compatible with the current version of AWS Lambda Node.JS support, please use Node 0.10 for development.

# Running tests

summary format

    npm test

list test names

    npm test -- full

filter by name

    npm test -- filter=prefix


## Using a non-default AWS profile/credentials

create a .env file in the main project folder (this is ignored by .gitignore) and add your credentials there. This file will be loaded
into the environment at the start of the test run, if it exists. See [Setting AWS Credentials for NodeJS](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html). The easiest
way to do this is probably to just create a .env file with the profile name

````
AWS_PROFILE=beamup-test
````

and then define the actual keys in your main .aws/config file
