#add-sns-event-source

usage: `claudia add-sns-event-source {OPTIONS}`

Add a notification event to Lambda when a message is published on a SNS topic

## _OPTIONS_ are:

*  `--topic`:  the ARN of the SNS topic
*  `--version`:  _optional_ Bind to a particular version
  * _For example_: production
  * _Defaults to_: latest version
*  `--source`:  _optional_ Directory with project files
  * _Defaults to_: current directory
*  `--config`:  _optional_ Config file containing the resource names
  * _Defaults to_: claudia.json
