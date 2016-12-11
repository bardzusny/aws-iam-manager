const Promise = require('bluebird');
const AWS = require('aws-sdk');
const bunyan = require('bunyan');
const _ = require('lodash');

AWS.config.setPromisesDependency(Promise);

const iam = new AWS.IAM();
const log = bunyan.createLogger({ name: 'users' });

const createUser = UserName => new Promise((resolve, reject) => {
  log.info({ UserName }, 'Creating new user...');

  iam.createUser({
    UserName,
    Path: process.env.USERS_PATH,
  }).promise().then(resolve).catch(reject);
});

const deleteUser = UserName => new Promise((resolve, reject) => {
  log.info({ UserName }, 'Deleting old user...');
  iam.deleteUser({ UserName }).promise().then(resolve).catch(reject);
});

const updateUsers = json => new Promise((resolve, reject) => {
  log.info({ newData: json }, 'Updating users');

  iam.listUsers({
    PathPrefix: process.env.USERS_PATH,
  }).promise().then(data => {
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
      .then(result => {
        log.info('Updating users finished');
        return resolve(result);
      })
      .catch(reject);
  }).catch(error => {
    log.error(error, 'Error while listing user');
    return reject(error);
  });
});

module.exports = {
  updateUsers,
};
