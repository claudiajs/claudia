
api.delete('/#{endpoint}/{id}', function (request) {
  var parameters = {
    TableName: '#{endpoint}',
    Key: {
      #{endpoint}Id: request.pathParams.id
    }
  };
  return dynamoDb
    .delete(parameters)
    .promise();
});
