'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const bunyan = require('bunyan');
const _ = require('lodash');

AWS.config.setPromisesDependency(Promise);

const iam = new AWS.IAM();
const log = bunyan.createLogger({ name: 'groups' });

const addUserToGroup = (UserName, GroupName) => new Promise((resolve, reject) => {
  log.info({ UserName, GroupName }, 'Assigning user to group');

  iam.addUserToGroup({
    UserName,
    GroupName,
  }).promise().then(resolve).catch(reject);
});

const removeUserFromGroup = (UserName, GroupName) => new Promise((resolve, reject) => {
  iam.removeUserFromGroup({
    UserName,
    GroupName
  }).promise().then(resolve).catch(reject);
});

const createGroup = GroupName => new Promise((resolve, reject) => {
  log.info({ GroupName }, 'Creating new group...');
  iam.createGroup({
    GroupName,
    Path: process.env.USERS_PATH,
  }).promise().then(resolve).catch(reject);
});

const reassignUsers = (data, group) => new Promise((resolve, reject) => {
  const oldGroupUsers = data.Users.map(u => u.UserName);
  const newGroupUsers = group.users;

  const usersToAdd = _.difference(newGroupUsers, oldGroupUsers);
  const usersToDelete = _.difference(oldGroupUsers, newGroupUsers);

  log.info({
    oldGroupUsers,
    newGroupUsers,
    usersToAdd,
    usersToDelete,
  });

  return Promise.all(usersToAdd
      .map(user => addUserToGroup(user, group.name))
      .concat(usersToDelete
        .map(user => removeUserFromGroup(user, group.name))))
    .then(result => {
      log.info('Updating users-groups relations finished');
      return resolve(result);
    })
    .catch(error => {
      log.error({ error }, 'Error while assignign user to group');
      return reject(error);
    });
});

const getPolicyArn = PolicyName => new Promise((resolve, reject) => {
  iam.listPolicies({
    PathPrefix: process.ENV.USERS_PATH,
  }).promise()
    .then(payload => resolve(payload.Polices.filter(policy => policy.PolicyName === PolicyName)))
    .catch(reject);
});

const attachGroupPolicy = (GroupName, PolicyName) => new Promise((resolve, reject) => {


  iam.attachGroupPolicy({
    GroupName,
    PolicyArn,
  }).promise().then(data => {

  }).catch(reject);
});

const forgeNewGroup = (group, error) => new Promise((resolve, reject) => {
  if (error.code === 'NoSuchEntity') {
    log.info({ name: group.name }, 'Group not found, creating...');

    return createGroup(group.name).then(() => {
      reassignUsers({ Users: [] }, group)
        .then(resolve)
        .catch(reject);
    }).catch(reject);
  }

  return reject(error);
});

const process = json => new Promise((resolve, reject) => {
  const promises = json.groups.map(group =>
    iam.getGroup({ GroupName: group.name }).promise().then(data => {
      log.info({ data }, 'Group info');

      return reassignUsers(data, group).then();
    }).catch(error => {
      log.warn({ error }, 'Error while fetching group');

      return forgeNewGroup(group, error);
    })
  );

  return Promise.all(promises).then(resolve).catch(reject);
});

module.exports = {
  process,
};
