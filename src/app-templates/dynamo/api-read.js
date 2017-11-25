
api.get('/#{endpoint}', function (request) {
  return dynamoDb
    .scan({ TableName: '#{endpoint}' })
    .promise()
    .then(response => response.Items);
}, { success: 200 });

api.get('/#{endpoint}/{id}', function (request) {
  var params = {
    TableName: '#{endpoint}',
    Key: {
      #{endpoint}Id: request.pathParams.id
    }
  };
  return dynamoDb
    .get(params)
    .promise()
    .then(response => response.Item);
});
