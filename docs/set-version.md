#set-version

usage: `claudia set-version {OPTIONS}`

Create or update a lambda alias/api stage to point to the latest deployed version

## _OPTIONS_ are:

*  `--version` the alias to update or create
  _For example_: production
*  `--source` _[OPTIONAL]_ Directory with project files
  _Defaults to_: current directory
*  `--config` _[OPTIONAL]_ Config file containing the resource names
  _Defaults to_: claudia.json
