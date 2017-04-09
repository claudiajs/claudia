# test-lambda

Execute the lambda function and print out the response

## Usage

```bash
claudia test-lambda {OPTIONS}
```

## Options

*  `--event`:  (_optional_) Path to a file containing the JSON test event
*  `--version`:  (_optional_) A version alias to test
    * _Defaults to_: latest version
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
