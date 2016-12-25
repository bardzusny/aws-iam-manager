'use strict';

const YAML = require('js-yaml');
const axios = require('axios');
const bunyan = require('bunyan');
const Promise = require('bluebird');

const log = bunyan.createLogger({ name: 'aws-iam-manager' });
const users = require('./users');
const groups = require('./groups');
const polices = require('./polices');

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

// TODO: Wrap in fancy loop/map (with concurrency = 1 for sequential processing) instead of repeating 4 times
// TODO: Group in objects with blob URLs (inside axios.get) and promises (factory?)
const processUsers = blobUrl => new Promise((resolve, reject) => {
  getJson(blobUrl)
    .then(users.update)
    .then(resolve)
    .catch(reject);
});

const processGroups = blobUrl => new Promise((resolve, reject) => {
  getJson(blobUrl)
    .then(groups.update)
    .then(resolve)
    .catch(reject);
});

const processPolices = blobUrl => new Promise((resolve, reject) => {
  getJson(blobUrl)
    .then(polices.update)
    .then(resolve)
    .catch(reject);
});

module.exports.handler = (event, context, callback) => {
  const returnError = error => {
    log.fatal({ error }, 'Internal error');
    return callback(null, { statusCode: 400, error });
  };

  const returnSuccess = data => {
    log.info({ data }, 'Finish');
    return callback(null, { statusCode: 200, data });
  };

  log.info(event, 'SNS event received');
  const githubMessage = JSON.parse(event.Records[0].Sns.Message);
  const contentsUrl = `${githubMessage.repository.contents_url.replace('{+path}', '')}${getAuth()}`;

  axios.get(contentsUrl).then(payload => {
    const usersBlobUrl = payload.data
      .filter(file => file.name === 'users.yml')[0].git_url;

    const groupsBlobUrl = payload.data
      .filter(file => file.name === 'groups.yml')[0].git_url;

    const policesBlobUrl = payload.data
      .filter(file => file.name === 'policies.yml')[0].git_url;

    const promises = [{
      fn: processUsers, url: usersBlobUrl,
    }, {
      fn: processGroups, url: groupsBlobUrl,
    }, {
      fn: processPolices, url: policesBlobUrl,
    }];

    return Promise.map(promises, promise => promise.fn(promise.url),
      { concurrency: 1 }).then(returnSuccess).catch(returnError);
  }).catch(returnError);
};
