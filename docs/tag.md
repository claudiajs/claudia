# tag

Add tags (key-value pairs) to a lambda function

## Usage

```bash
claudia tag {OPTIONS}
```

## Options

*  `--tags`:  The list of tags (key-value pairs) to assign to the lambda function.
    * _For example_: Team=onboarding,Project=amarillo
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
