# update

Deploy a new version of the Lambda function using project files, update any associated web APIs

## Usage

```bash
claudia update {OPTIONS}
```

## Options

*  `--version`:  (_optional_) A version alias to automatically assign to the new deployment
    * _For example_: development
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
*  `--no-optional-dependencies`:  (_optional_) Do not upload optional dependencies to Lambda.
*  `--use-local-dependencies`:  (_optional_) Do not install dependencies, use local node_modules directory instead
*  `--cache-api-config`:  (_optional_) Name of the stage variable for storing the current API configuration signature.
    If set, it will also be used to check if the previously deployed configuration can be re-used and speed up deployment
    * _For example_: claudiaConfigCache
*  `--keep`:  (_optional_) keep the produced package archive on disk for troubleshooting purposes.
    If not set, the temporary files will be removed after the Lambda function is successfully created
*  `--use-s3-bucket`:  (_optional_) The name of a S3 bucket that Claudia will use to upload the function code before installing in Lambda.
    You can use this to upload large functions over slower connections more reliably, and to leave a binary artifact
    after uploads for auditing purposes. If not set, the archive will be uploaded directly to Lambda
    * _For example_: claudia-uploads
*  `--set-env`:  (_optional_) comma-separated list of VAR=VALUE environment variables to set
    * _For example_: S3BUCKET=testbucket,SNSQUEUE=testqueue
*  `--set-env-from-json`:  (_optional_) file path to a JSON file containing environment variables to set
    * _For example_: production-env.json
*  `--env-kms-key-arn`:  (_optional_) KMS Key ARN to encrypt/decrypt environment variables
