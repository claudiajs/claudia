# add-scheduled-event

Add a recurring notification event

## Usage

```bash
claudia add-scheduled-event {OPTIONS}
```

## Options

*  `--event`:  Path to a JSON event file that will be sent to lambda periodically
*  `--name`:  Name for the scheduled event rule that will be created
*  `--schedule`:  A schedule expression. For syntax options, see
    http://docs.aws.amazon.com/AmazonCloudWatch/latest/DeveloperGuide/ScheduledEvents.html
    * _For example_: rate(5 minutes)
*  `--rate`:  (_optional_) a shorthand for rate-based expressions, without the brackets.
    If this is specified, the schedule argument is not required/ignored
    * _For example_: 5 minutes
*  `--cron`:  (_optional_) a shorthand for cron-based expressions, without the brackets.
    If this is specified, the schedule argument is not required/ignored
    * _For example_: 0 8 1 * ? *
*  `--version`:  (_optional_) Bind to a particular version
    * _For example_: production
    * _Defaults to_: latest version
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
