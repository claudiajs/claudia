# set-cloudfront-trigger

Set up Lambda@Edge CloudFront behavior event triggers

## Usage

```bash
claudia set-cloudfront-trigger {OPTIONS}
```

## Options

*  `--distribution-id`:  CloudFront distribution ID
    * _For example_: E17XW3PXPSO9
*  `--event-types`:  Comma-separated list of trigger event types. See http://docs.aws.amazon.com/cloudfront/latest/APIReference/API_LambdaFunctionAssociation.html for valid values
    * _For example_: viewer-request,origin-response
*  `--version`:  Alias or numerical version of the lambda function to execute the trigger
    * _For example_: production
*  `--path-pattern`:  (_optional_) The path pattern matching the distribution cache behavior you want to change
    * _For example_: /dev
    * _Defaults to_: change is applied to the default distribution cache behavior
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
*  `--aws-delay`:  (_optional_) number of milliseconds betweeen retrying AWS operations if they fail
    * _For example_: 3000
    * _Defaults to_: 5000
*  `--aws-retries`:  (_optional_) number of times to retry AWS operations if they fail
    * _For example_: 15
    * _Defaults to_: 15
