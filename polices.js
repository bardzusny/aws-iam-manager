'use strict';

const Promise = require('bluebird');
const AWS = require('aws-sdk');
const bunyan = require('bunyan');

const iam = new AWS.IAM();
const log = bunyan.createLogger({ name: 'polices' });

const createPolicy = (PolicyName, PolicyDocument) => new Promise((resolve, reject) => {
  log.info({ PolicyName, PolicyDocument }, 'Creating new policy...');

  iam.createPolicy({
    PolicyName,
    PolicyDocument,
    Path: process.env.USERS_PATH,
  }).promise().then(resolve).catch(reject);
});

const removePolicy = PolicyArn => new Promise((resolve, reject) => {
  log.info({ PolicyArn }, 'Deleting old policy...');
  iam.deletePolicy({ PolicyArn }).promise().then(resolve).catch(reject);
});

const processPolicies = json => new Promise((resolve, reject) => {
  resolve();

  iam.listPolicies({
    PathPrefix: process.env.USERS_PATH,
  }).promise().then(data => {
    log.silly(data);

    const rejectError = error => {
      log.error({ error }, 'Error while re-creating policies');

      return reject(error);
    };

    // Because we have not power to get current policies document and compare them
    // We have to remove all policies and re-create them from scratch.
    // Policies are also immutable, it's possible to version them but AWS limits version count to 5.
    Promise.all(data.Policies.map(policy => removePolicy(policy.Arn))).then(deleteResult => {
      log.info({ deleteResult }, 'Old policies removed, creating new...');

      Promise.all(json.policies.map(policy => createPolicy(policy.name, policy.document))).then(createResult => {
        log.info({ createResult }, 'New policies created');

        return resolve({ createResult, deleteResult });
      }).catch(rejectError);
    }).catch(rejectError);

  }).catch(error => {
    log.error(error, 'Error while listing policies user');
    return reject(error);
  });
});

module.exports = {
  processPolicies,
};