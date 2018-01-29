# add-kinesis-event-source

Set up Kinesis Data Stream event triggers

## Usage

```bash
claudia add-kinesis-event-source {OPTIONS}
```

## Options

*  `--stream`:  Kinesis data stream name or ARN
    * _For example_: analytics-events
*  `--batch-size`:  (_optional_) The batch size for the Lambda event source mapping
    * _For example_: 50
    * _Defaults to_: 100
*  `--starting-position`:  (_optional_) The stating position for the event source. Can be LATEST, TRIM_HORIZON or AT_TIMESTAMP.  Check out https://docs.aws.amazon.com/cli/latest/reference/lambda/create-event-source-mapping.html for detailed info on values
    * _For example_: AT_TIMESTAMP
    * _Defaults to_: LATEST
*  `--starting-timestamp`:  (_optional_) The initial timestamp when starting-position is set to AT_TIMESTAMP. Check out https://docs.aws.amazon.com/cli/latest/reference/lambda/create-event-source-mapping.html for detailed info
    * _For example_: Wed Dec 31 1969 16:00:00 GMT-0800 (PST)
*  `--skip-iam`:  (_optional_) Do not try to modify the IAM role for Lambda to allow Kinesis execution
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
