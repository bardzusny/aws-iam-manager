'use strict';

const YAML = require('js-yaml');
const axios = require('axios');
const AWS = require('aws-sdk');
const bunyan = require('bunyan');
const Promise = require('bluebird');
const _ = require('lodash');

const iam = new AWS.IAM();
const log = bunyan.createLogger({ name: 'aws-iam-manager' });

const getAuth = () =>
  `?access_token=${process.env.GITHUB_ACCESS_TOKEN}`;

const getJson = url => new Promise((resolve, reject) => {
  log.info({ url }, 'Downloading...');

  axios.get(`${url}${getAuth()}`).then(payload => {
    const data = new Buffer(payload.data.content, payload.data.encoding).toString('ascii');

    log.info({ data, payload: payload.data }, 'Data from blob loaded.');
    return resolve(YAML.load(data));
  }).catch(reject);
});

const createUser = UserName => new Promise((resolve, reject) => {
  log.info({ UserName }, 'Creating new user...');

  iam.createUser({
    UserName,
    Path: process.env.USERS_PATH,
  }, (err, data) => {
    if (err) return reject(err);
    return resolve(data);
  });
});

const deleteUser = UserName => new Promise((resolve, reject) => {
  log.info({ UserName }, 'Deleting old user...');

  iam.deleteUser({
    UserName,
  }, (err, data) => {
    if (err) return reject(err);
    return resolve(data);
  });
});

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

const updateUsers = json => new Promise((resolve, reject) => {
  log.info({ newData: json }, 'Updating users');

  iam.listUsers({
    PathPrefix: process.env.USERS_PATH,
  }, (err, data) => {
    if (err) return reject(err);

    const newUsers = json.users;
    const oldUsers = data.Users.map(u => u.UserName);

    const usersToAdd = _.difference(newUsers, oldUsers);
    const usersToDelete = _.difference(oldUsers, newUsers);

    log.info({
      newUsers,
      oldUsers,
      usersToAdd,
      usersToDelete,
    });

    return Promise.all(usersToAdd
        .map(createUser)
        .concat(usersToDelete
          .map(deleteUser)))
      .then(resolve)
      .catch(reject);
  });
});

const processUsers = blobUrl => new Promise((resolve, reject) => {
  getJson(blobUrl)
    .then(updateUsers)
    .then(resolve)
    .catch(reject);
});

module.exports.handler = (event, context, callback) => {
  const returnError = error => {
    log.fatal({ error }, 'Internal error');
    return callback(null, { statusCode: 400, error });
  }

  const contentsUrl = `${event.repository.contents_url.replace('{+path}', '')}${getAuth()}`;

  axios.get(contentsUrl).then(payload => {
    const usersBlobUrl = payload.data
      .filter(file => file.name === 'users.yml')[0].git_url;

    const rolesBlobUrl = payload.data
      .filter(file => file.name === 'roles.yml')[0].git_url;

    const groupsBlobUrl = payload.data
      .filter(file => file.name === 'groups.yml')[0].git_url;

    processUsers(usersBlobUrl).then(data => {
      log.info({ data }, 'Processing users finished');

      callback(null, { statusCode: 200 });
    }).catch(returnError);
  }).catch(returnError);
};
