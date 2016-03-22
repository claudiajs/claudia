#set-version

Create or update a lambda alias/api stage to point to the latest deployed version

## Usage

```bash
claudia set-version {OPTIONS}
```

## Options

*  `--version`:  the alias to update or create
  * _For example_: production
*  `--source`:  _optional_ Directory with project files
  * _Defaults to_: current directory
*  `--config`:  _optional_ Config file containing the resource names
  * _Defaults to_: claudia.json
