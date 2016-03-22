#test-lambda

usage: `claudia test-lambda {OPTIONS}`

Execute the lambda function and print out the response

## _OPTIONS_ are:

*  `--event` _[OPTIONAL]_ Path to a file containing the JSON test event
*  `--version` _[OPTIONAL]_ A version alias to test
  _Defaults to_: latest version
*  `--source` _[OPTIONAL]_ Directory with project files
  _Defaults to_: current directory
*  `--config` _[OPTIONAL]_ Config file containing the resource names
  _Defaults to_: claudia.json
