SCRIPT_DIR=`dirname $BASH_SOURCE[0]` 
PROJECT_DIR=`dirname $SCRIPT_DIR`
[[ -e $PROJECT_DIR/.env ]] && source $PROJECT_DIR/.env

if [ -z "$AWS_PROFILE" ]; then
  AWS_PROFILE=default
fi

echo using $AWS_PROFILE in region $AWS_REGION

functions=`aws lambda list-functions --query 'Functions[?starts_with(FunctionName,\`test\`)].FunctionName' --output text --profile $AWS_PROFILE --region $AWS_REGION`
for fun in $functions; do
  echo deleting function $fun
  aws lambda delete-function --function-name $fun --profile $AWS_PROFILE --region $AWS_REGION
done

apis=`aws apigateway get-rest-apis --query 'items[?starts_with(name,\`test\`)].id' --output text --profile $AWS_PROFILE --region $AWS_REGION --region $AWS_REGION`
for api in $apis; do
  echo deleting API $api
  sleep 10 
  aws apigateway delete-rest-api --rest-api-id $api --profile $AWS_PROFILE --region $AWS_REGION
done

roles=`aws iam list-roles --query 'Roles[?starts_with(RoleName, \`test\`)].RoleName' --output text --profile $AWS_PROFILE --region $AWS_REGION`

for role in $roles; do
  echo deleting policies for role $role
  policies=`aws iam list-role-policies --role-name=$role --query PolicyNames --output text --profile $AWS_PROFILE --region $AWS_REGION`
  for policy in $policies; do 
    echo deleting policy $policy for role $role
    aws iam delete-role-policy --policy-name $policy --role-name $role --profile $AWS_PROFILE --region $AWS_REGION
  done
  attached=`aws iam list-attached-role-policies  --role-name=$role --query AttachedPolicies[].PolicyArn --output text --profile $AWS_PROFILE --region $AWS_REGION`
  for policy in $attached; do 
    echo detaching policy $policy for role $role
    aws iam detach-role-policy --policy-arn $policy --role-name $role --profile $AWS_PROFILE --region $AWS_REGION
  done
  echo deleting role $role
  aws iam delete-role --role-name $role --profile $AWS_PROFILE  --region $AWS_REGION
done


lambdaLogs=`aws logs describe-log-groups --query 'logGroups[?starts_with(logGroupName,\`/aws/lambda/test\`)].logGroupName' --output text --profile $AWS_PROFILE  --region $AWS_REGION`
for log in $lambdaLogs; do
  echo deleting log $log
  aws logs delete-log-group --log-group-name $log --profile $AWS_PROFILE  --region $AWS_REGION
done

apiLogs=`aws logs describe-log-groups --query 'logGroups[?starts_with(logGroupName,\`API-Gateway-Execution-Logs\`)].logGroupName' --output text --profile $AWS_PROFILE  --region $AWS_REGION`
for log in $apiLogs; do
  echo deleting log $log
  aws logs delete-log-group --log-group-name $log --profile $AWS_PROFILE  --region $AWS_REGION
done

buckets=`aws s3api list-buckets --output text --query 'Buckets[?starts_with(Name,\`test\`)].Name'`
for bucket in $buckets; do
  echo deleting bucket $bucket
  aws s3 rm --recursive s3://$bucket
  aws s3 rb s3://$bucket
done
