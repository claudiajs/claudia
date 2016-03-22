#add-s3-event-source

usage: `claudia add-s3-event-source {OPTIONS}`

Add a notification event to Lambda when a file is added to a S3 bucket, and set up access permissions

## _OPTIONS_ are:

*  `--bucket`:  S3 Bucket name which will push notifications to Lambda
*  `--prefix`:  _optional_ Prefix filter for S3 keys that will cause the event
  * _For example_: infiles/
*  `--version`:  _optional_ Bind to a particular version
  * _For example_: production
  * _Defaults to_: latest version
*  `--source`:  _optional_ Directory with project files
  * _Defaults to_: current directory
*  `--config`:  _optional_ Config file containing the resource names
  * _Defaults to_: claudia.json
