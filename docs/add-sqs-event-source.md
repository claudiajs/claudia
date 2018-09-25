# add-sqs-event-source

Set up SQS event triggers

## Usage

```bash
claudia add-sqs-event-source {OPTIONS}
```

## Options

*  `--queue`:  SQS Queue name or ARN
    * _For example_: analytics-events
*  `--batch-size`:  (_optional_) The batch size for the Lambda event source mapping
    * _For example_: 2
    * _Defaults to_: 10
*  `--skip-iam`:  (_optional_) Do not try to modify the IAM role for Lambda to allow SQS execution
    * _For example_: true
*  `--version`:  (_optional_) Alias or numerical version of the lambda function to execute the trigger
    * _For example_: production
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
