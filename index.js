'use strict';

const YAML = require('js-yaml');
const axios = require('axios');
const AWS = require('aws-sdk');
const bunyan = require('bunyan');

const iam = new AWS.IAM();
const log = bunyan.createLogger({ name: 'aws-iam-manager' });

const getAuth = () =>
  `?access_token=${process.env.GITHUB_ACCESS_TOKEN}`;

const getJson = url => new Promise((resolve, reject) => {
  axios.get(`${url}${getAuth()}`).then(payload => {
    const data = new Buffer(payload.data.content, payload.data.encoding).toString('ascii');

    log.info({ data, payload: payload.data }, 'Data from blob loaded.');
    return resolve(YAML.load(data));
  }).catch(reject);
});

const updateUsers = json => new Promise((resolve, reject) => {
  log.info({ newData: json }, 'Updating users');

  iam.listUsers({
    PathPrefix: process.env.USERS_PATH,
  }, (err, data) => {
    if (err) return reject(err);

    log.info(data, 'Current users');
    return resolve(data);
  });
});

const processUsers = blobUrl => new Promise((resolve, reject) => {
  log.info({ blobUrl }, 'Processing users.yml');

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
