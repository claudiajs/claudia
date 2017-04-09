# set-version

Create or update a lambda alias/api stage to point to the latest deployed version

## Usage

```bash
claudia set-version {OPTIONS}
```

## Options

*  `--version`:  the alias to update or create
    * _For example_: production
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
*  `--set-env`:  (_optional_) comma-separated list of VAR=VALUE environment variables to set
    * _For example_: S3BUCKET=testbucket,SNSQUEUE=testqueue
*  `--set-env-from-json`:  (_optional_) file path to a JSON file containing environment variables to set
    * _For example_: production-env.json
*  `--env-kms-key-arn`:  (_optional_) KMS Key ARN to encrypt/decrypt environment variables
