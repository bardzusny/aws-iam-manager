const Promise = require('bluebird');
const AWS = require('aws-sdk');
const bunyan = require('bunyan');

const iam = new AWS.IAM();
const log = bunyan.createLogger({ name: 'groups' });

const addUserToGroup = (UserName, GroupName) => new Promise((resolve, reject) => {
  log.info({ user, group }, 'Assigning user to group');

  iam.addUserToGroup({
    UserName,
    GroupName,
  }, (err, data) => {
    if (err) return reject(err);
    return resolve(data);
  });
});

const removeUserFromGroup = (UserName, GroupName) => new Promise((resolve, reject) => {

});

const updateGroups = json => new Promise((resolve, reject) => {
  resolve();
});

module.exports = {
  updateGroups,
};