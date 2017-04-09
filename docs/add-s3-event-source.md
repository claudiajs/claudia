# add-s3-event-source

Add a notification event to Lambda when a file is added to a S3 bucket, and set up access permissions

## Usage

```bash
claudia add-s3-event-source {OPTIONS}
```

## Options

*  `--bucket`:  S3 Bucket name which will push notifications to Lambda
*  `--prefix`:  (_optional_) Prefix filter for S3 keys that will cause the event
    * _For example_: infiles/
*  `--suffix`:  (_optional_) Suffix filter for S3 keys that will cause the event
    * _For example_: .jpg
*  `--version`:  (_optional_) Bind to a particular version
    * _For example_: production
    * _Defaults to_: latest version
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
*  `--events`:  (_optional_) Comma separated list of event types that trigger the function
    * _For example_: s3:ObjectCreated:*,s3:ObjectRemoved:*
    * _Defaults to_: s3:ObjectCreated:*
