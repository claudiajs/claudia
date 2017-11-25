const ApiBuilder = require('claudia-api-builder'),
  AWS = require('aws-sdk'),
  uuidv4 = require('uuid/v4');

var api = new ApiBuilder(),
  dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports = api;
