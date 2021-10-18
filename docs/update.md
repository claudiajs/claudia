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
*  `--arch`:  (_optional_) Specifies the desired architecture, either x86_64 or arm64. 
    If this option is not provided, the architecture will not be modfied.
    * _Introduced in version_: 5.13.2
*  `--no-optional-dependencies`:  (_optional_) Do not upload optional dependencies to Lambda.
*  `--use-local-dependencies`:  (_optional_) Do not install dependencies, use local node_modules directory instead
*  `--npm-options`:  (_optional_) Any additional options to pass on to NPM when installing packages. Check https://docs.npmjs.com/cli/install for more information
    * _For example_: --ignore-scripts
    * _Introduced in version_: 5.0.0
*  `--cache-api-config`:  (_optional_) Name of the stage variable for storing the current API configuration signature.
    If set, it will also be used to check if the previously deployed configuration can be re-used and speed up deployment
    * _For example_: claudiaConfigCache
*  `--post-package-script`:  (_optional_) the name of a NPM script to execute custom processing after claudia finished packaging your files.
    Note that development dependencies are not available at this point, but you can use npm uninstall to remove utility tools as part of this step.
    * _For example_: customNpmScript
    * _Introduced in version_: 5.0.0
*  `--keep`:  (_optional_) keep the produced package archive on disk for troubleshooting purposes.
    If not set, the temporary files will be removed after the Lambda function is successfully created
*  `--use-s3-bucket`:  (_optional_) The name of a S3 bucket that Claudia will use to upload the function code before installing in Lambda.
    You can use this to upload large functions over slower connections more reliably, and to leave a binary artifact
    after uploads for auditing purposes. If not set, the archive will be uploaded directly to Lambda.
    
    * _For example_: claudia-uploads
*  `--s3-key`:  (_optional_) The key to which the function code will be uploaded in the s3 bucket referenced in `--use-s3-bucket`
    * _For example_: path/to/file.zip
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
*  `--layers`:  (_optional_) A comma-delimited list of Lambda layers to attach to this function. Setting this during an update replaces all previous layers.
    * _For example_: arn:aws:lambda:us-east-1:12345678:layer:ffmpeg:4
*  `--add-layers`:  (_optional_) A comma-delimited list of additional Lambda layers to attach to this function. Setting this during an update leaves old layers in place, and just adds new layers.
    * _For example_: arn:aws:lambda:us-east-1:12345678:layer:ffmpeg:4
*  `--remove-layers`:  (_optional_) A comma-delimited list of Lambda layers to remove from this function. It will not remove any layers apart from the ones specified in the argument.
    * _For example_: arn:aws:lambda:us-east-1:12345678:layer:ffmpeg:4
*  `--dlq-sns`:  (_optional_) Dead letter queue SNS topic name or ARN
    * _For example_: arn:aws:sns:us-east-1:123456789012:my_corporate_topic
*  `--skip-iam`:  (_optional_) Do not try to modify the IAM role for Lambda
    * _For example_: true
*  `--aws-delay`:  (_optional_) number of milliseconds betweeen retrying AWS operations if they fail
    * _For example_: 3000
    * _Defaults to_: 5000
*  `--aws-retries`:  (_optional_) number of times to retry AWS operations if they fail
    * _For example_: 15
    * _Defaults to_: 15
