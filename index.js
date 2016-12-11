'use strict';

const YAML = require('js-yaml');
const axios = require('axios');
const bunyan = require('bunyan');
const Promise = require('bluebird');

const log = bunyan.createLogger({ name: 'aws-iam-manager' });
const users = require('./users');
const groups = require('./groups');
const roles = require('./roles');

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

const processUsers = blobUrl => new Promise((resolve, reject) => {
  getJson(blobUrl)
    .then(users.updateUsers)
    .then(resolve)
    .catch(reject);
});

const processGroups = blobUrl => new Promise((resolve, reject) => {
  getJson(blobUrl)
    .then(groups.updateGroups)
    .then(resolve)
    .catch(reject);
});

const processRoles = blobUrl => new Promise((resolve, reject) => {
  getJson(blobUrl)
    .then(roles.updateRoles)
    .then(resolve)
    .catch(reject);
});

module.exports.handler = (event, context, callback) => {
  const returnError = error => {
    log.fatal({ error }, 'Internal error');
    return callback(null, { statusCode: 400, error });
  }

  const returnSuccess = data => {
    log.info({ data }, 'Finish');
    return callback(null, { statusCode: 200, data });
  }

  const contentsUrl = `${event.repository.contents_url.replace('{+path}', '')}${getAuth()}`;

  axios.get(contentsUrl).then(payload => {
    const usersBlobUrl = payload.data
      .filter(file => file.name === 'users.yml')[0].git_url;

    const rolesBlobUrl = payload.data
      .filter(file => file.name === 'roles.yml')[0].git_url;

    const groupsBlobUrl = payload.data
      .filter(file => file.name === 'groups.yml')[0].git_url;

    const promises = [{
      fn: processUsers, url: usersBlobUrl,
    }, {
      fn: processGroups, url: groupsBlobUrl,
    }, {
      fn: processRoles, url: rolesBlobUrl,
    }];

    return Promise.map(promises, promise => {
      return promise.fn(promise.url);
    }, { concurrency: 1 }).then(returnSuccess).catch(returnError);
  }).catch(returnError);
};
