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
*  `--timeout`:  (_optional_) The function execution time, in seconds, at which AWS Lambda should terminate the function
*  `--runtime`:  (_optional_) Node.js runtime to use. For supported values, see
    http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html
*  `--memory`:  (_optional_) The amount of memory, in MB, your Lambda function is given.
    The value must be a multiple of 64 MB.
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
*  `--s3-sse`:  (_optional_) The type of Server Side Encryption applied to the S3 bucket referenced in `--use-s3-bucket`
    * _For example_: AES256
*  `--update-env`:  (_optional_) comma-separated list of VAR=VALUE environment variables to set, merging with old variables
    * _For example_: S3BUCKET=testbucket,SNSQUEUE=testqueue
*  `--set-env`:  (_optional_) comma-separated list of VAR=VALUE environment variables to set. replaces the whole set, removing old variables.
    * _For example_: S3BUCKET=testbucket,SNSQUEUE=testqueue
*  `--update-env-from-json`:  (_optional_) file path to a JSON file containing environment variables to set, merging with old variables
    * _For example_: production-env.json
*  `--set-env-from-json`:  (_optional_) file path to a JSON file containing environment variables to set. replaces the whole set, removing old variables.
    * _For example_: production-env.json
*  `--env-kms-key-arn`:  (_optional_) KMS Key ARN to encrypt/decrypt environment variables
