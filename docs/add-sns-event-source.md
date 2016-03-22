#add-sns-event-source

usage: `claudia add-sns-event-source {OPTIONS}`

Add a notification event to Lambda when a message is published on a SNS topic

## _OPTIONS_ are:

*  `--topic` the ARN of the SNS topic
*  `--version` _[OPTIONAL]_ Bind to a particular version
  _For example_: production
  _Defaults to_: latest version
*  `--source` _[OPTIONAL]_ Directory with project files
  _Defaults to_: current directory
*  `--config` _[OPTIONAL]_ Config file containing the resource names
  _Defaults to_: claudia.json
