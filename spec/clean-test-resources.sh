functions=`aws lambda list-functions --query 'Functions[?starts_with(FunctionName,\`test\`)].FunctionName' --output text`
for fun in $functions; do
  echo deleting function $fun
  aws lambda delete-function --function-name $fun
done

apis=`aws apigateway get-rest-apis --query 'items[?starts_with(name,\`test\`)].id' --output text`
for api in $apis; do
  echo deleting API $api
  sleep 10 
  aws apigateway delete-rest-api --rest-api-id $api
done

roles=`aws iam list-roles --query 'Roles[?starts_with(RoleName, \`test\`)].RoleName' --output text`


lambdaLogs=`aws logs describe-log-groups --query 'logGroups[?starts_with(logGroupName,\`/aws/lambda/test\`)].logGroupName' --output text`
for log in $lambdaLogs; do
  echo deleting log $log
  aws logs delete-log-group --log-group-name $log
done

apiLogs=`aws logs describe-log-groups --query 'logGroups[?starts_with(logGroupName,\`API-Gateway-Execution-Logs\`)].logGroupName' --output text`
for log in $apiLogs; do
  echo deleting log $log
  aws logs delete-log-group --log-group-name $log
done

buckets=`aws s3api list-buckets --output text --query 'Buckets[?starts_with(Name,\`test\`)].Name'`
for bucket in $buckets; do
  echo deleting bucket $bucket
  aws s3 rm --recursive s3://$bucket
  aws s3 rb s3://$bucket
done
