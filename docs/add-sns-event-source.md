# add-sns-event-source

Add a notification event to Lambda when a message is published on a SNS topic

## Usage

```bash
claudia add-sns-event-source {OPTIONS}
```

## Options

*  `--topic`:  the ARN of the SNS topic
*  `--version`:  (_optional_) Bind to a particular version
    * _For example_: production
    * _Defaults to_: latest version
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
*  `--filter-policy`:  (_optional_) JSON filter policy for the subscription
    * _For example_: {"payment-type": ["card"]}
*  `--filter-policy-file`:  (_optional_) name of a file containing the JSON filter policy for the subscription
    * _For example_: sns-filter-policy.json
