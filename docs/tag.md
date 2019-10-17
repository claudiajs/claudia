# tag

Add tags (key-value pairs) to the lambda function and any associated web API

## Usage

```bash
claudia tag {OPTIONS}
```

## Options

*  `--tags`:  The list of tags (key-value pairs) to assign to the lambda function and any associated web API
    * _For example_: Team=onboarding,Project=amarillo
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
