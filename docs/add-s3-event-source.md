#add-s3-event-source

usage: `claudia add-s3-event-source {OPTIONS}`

Add a notification event to Lambda when a file is added to a S3 bucket, and set up access permissions

## _OPTIONS_ are:

*  `--bucket` S3 Bucket name which will push notifications to Lambda
*  `--prefix` _[OPTIONAL]_ Prefix filter for S3 keys that will cause the event
  _For example_: infiles/
*  `--version` _[OPTIONAL]_ Bind to a particular version
  _For example_: production
  _Defaults to_: latest version
*  `--source` _[OPTIONAL]_ Directory with project files
  _Defaults to_: current directory
*  `--config` _[OPTIONAL]_ Config file containing the resource names
  _Defaults to_: claudia.json
