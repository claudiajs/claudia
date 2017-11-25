'use strict'
const path = require('path'),
  fs = require('fs'),
  fsUtil = require('./fs-util'),
  AWS = require('aws-sdk')

exports.genPackage = function (projectName, projectPath){
  return fsUtil.forceCopy(path.join(__dirname, '../app-templates/package.json'), path.join(projectPath))
    .then(() => fsUtil.replaceStringInFile(/#{projectName}/g, projectName, path.join(projectPath, 'package.json')));
}

exports.genRoute = function (appTemplateRelativePath, endpointName, projectPath) {
  return new Promise((resolve, reject) => {
    if (!appTemplateRelativePath) reject('appTemplateRelativePath wasn\'t specified')
    fs.readFile(path.join(__dirname, appTemplateRelativePath) , (err, data) => {
      if (err) reject(err)
      return resolve(data)
    })
  })
    .then((data) => {
      return new Promise((resolve, reject) => {
        fs.appendFile(path.join(projectPath, 'index.js'), data, (err) => {
          if (err) reject(err)
          return resolve()
        });
      })
    })
    .then(() => fsUtil.replaceStringInFile(/#{endpoint}/g, endpointName, path.join(projectPath, 'index.js')))
}

exports.genPolicies = function (projectName, projectPath){
  return fsUtil.copy(path.join(__dirname, '../app-templates/dynamo/policies.json'), path.join(projectPath, 'policies.json'));
}

exports.createTable = function (tableName, region){
  tableName = convertToCamelCase(tableName)
  let dynamoDb = new AWS.DynamoDB({region: region || 'us-east-1'});
  let parameters = {
    AttributeDefinitions: [{
      AttributeName: `${tableName}Id`,
      AttributeType: 'S'
    }],
    KeySchema: [{
      AttributeName: `${tableName}Id`,
      KeyType: 'HASH'
    }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1
    },
    TableName: tableName
  }

  return dynamoDb.createTable(parameters)
    .promise()
    .then(data => data)
}

function convertToCamelCase(input) {
  return input.toLowerCase().replace(/-(.)/g, function(match, group1) {
    return group1.toUpperCase();
  });
}
