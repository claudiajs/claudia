# add-cognito-user-pool-trigger

Configures the Lambda to run on a Cognito User Pool trigger

## Usage

```bash
claudia add-cognito-user-pool-trigger {OPTIONS}
```

## Options

*  `--user-pool-id`:  the Cognito User Pool ID
    * _For example_: us-east-1_2abcDEFG
*  `--events`:  Names of triggers to set up (use comma to separate multiple events). See http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CognitoIdentityServiceProvider.html#updateUserPool-property for valid names
    * _For example_: PreSignUp,PreAuthentication
*  `--version`:  (_optional_) Bind to a particular version
    * _For example_: production
    * _Defaults to_: latest version
*  `--source`:  (_optional_) Directory with project files
    * _Defaults to_: current directory
*  `--config`:  (_optional_) Config file containing the resource names
    * _Defaults to_: claudia.json
