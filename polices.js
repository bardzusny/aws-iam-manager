'use strict';

const Promise = require('bluebird');
const bunyan = require('bunyan');

const { iam } = require('./iam');
const log = bunyan.createLogger({ name: 'polices' });

function createPolicy(PolicyName, PolicyDocument) {
  log.info({ PolicyName, PolicyDocument }, 'Creating new policy...');

  return iam.createPolicy({
    PolicyName,
    PolicyDocument,
    Path: process.env.USERS_PATH,
  }).promise();
};

function removePolicy(PolicyArn) {
  log.info({ PolicyArn }, 'Deleting old policy...');
  return iam.deletePolicy({ PolicyArn }).promise();
};

function update(json) {
  log.info({ newData: json }, 'Updating policies');

  return iam.listPolicies({
    PathPrefix: process.env.USERS_PATH,
  }).promise()
    .catch(error => {
      log.error(error, 'Error while updating policies');
    })
    .then(data => {
      log.info(data, 'Old Policies');

      // Because we have not power to get current policies document and compare them
      // We have to remove all policies and re-create them from scratch.
      // Policies are also immutable, it's possible to version them but AWS limits version count to 5.
      return Promise.all(data.Policies.map(policy => removePolicy(policy.Arn)));
    })
    .then(deleteResult => {
      log.info({ deleteResult }, 'Old policies removed, creating new...');

      return Promise.join(
        deleteResult,
        Promise.all(json.policies.map(policy => createPolicy(policy.name, JSON.stringify(policy.document))))
      );
    })
    .then(([deleteResult, createResult]) => {
      log.info({ createResult }, 'New policies created');

      return { createResult, deleteResult };
    })
    .catch(error => {
      log.error({ error }, 'Error while re-creating policies');
    });
}

module.exports = {
  update,
};
