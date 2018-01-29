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
*  `--update-env`:  (_optional_) comma-separated list of VAR=VALUE environment variables to set, merging with old variables
    * _For example_: S3BUCKET=testbucket,SNSQUEUE=testqueue
*  `--set-env`:  (_optional_) comma-separated list of VAR=VALUE environment variables to set. replaces the whole set, removing old variables.
    * _For example_: S3BUCKET=testbucket,SNSQUEUE=testqueue
*  `--update-env-from-json`:  (_optional_) file path to a JSON file containing environment variables to set, merging with old variables
    * _For example_: production-env.json
*  `--set-env-from-json`:  (_optional_) file path to a JSON file containing environment variables to set. replaces the whole set, removing old variables.
    * _For example_: production-env.json
*  `--env-kms-key-arn`:  (_optional_) KMS Key ARN to encrypt/decrypt environment variables
