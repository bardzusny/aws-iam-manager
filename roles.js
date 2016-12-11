const Promise = require('bluebird');
const AWS = require('aws-sdk');
const bunyan = require('bunyan');

const iam = new AWS.IAM();
const log = bunyan.createLogger({ name: 'roles' });

const updateRoles = json => new Promise((resolve, reject) => {
  resolve();
});

module.exports = {
  updateRoles,
};
