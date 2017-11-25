
api.put('/#{endpoint}/{id}', function (request) {
  var parameters = {
    TableName: '#{endpoint}',
    Key: {
      #{endpoint}Id: request.pathParams.id
    },
    UpdateExpression: 'set #{endpoint}Name = :n',
    ExpressionAttributeValues: {
      ':n': request.body.#{endpoint}Name
    },
    ReturnValues: 'UPDATED_NEW'
  };

  return dynamoDb
    .update(parameters)
    .promise();
});
