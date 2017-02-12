'use strict';

const Promise = require('bluebird');
const { expect } = require('chai');
const sinon = require('sinon');

const { iam } = require('../iam');
const policies = require('../polices');

describe('Policies update method', () => {
  let results;

  before(() => {
    process.env.USERS_PATH = 'exampleUsersPath';

    sinon.stub(iam, 'listPolicies', () => ({
      promise() {
        return Promise.resolve({
          Policies: [
            { Arn: 'examplePolicy1Arn' },
            { Arn: 'examplePolicy2Arn' },
          ],
        });
      },
    }));

    sinon.stub(iam, 'createPolicy', () => ({
      promise() { return Promise.resolve('createPolicyResult') }
    }));

    sinon.stub(iam, 'deletePolicy', () => ({
      promise() { return Promise.resolve('deletePolicyResult') }
    }));
  });

  beforeEach((done) => {
    iam.listPolicies.reset();
    iam.createPolicy.reset();
    iam.deletePolicy.reset();

    policies.update({
      policies: [
        { name: 'policy1', document: { policy1: 'policy1' } },
        { name: 'policy2', document: { policy2: 'policy2' } },
      ],
    }).then((res) => {
      results = res;
      done();
    });
  });

  after(() => {
    iam.listPolicies.restore();
    iam.createPolicy.restore();
    iam.deletePolicy.restore();
  });

  it('calls iam.listPolicies properly', () => {
    expect(iam.listPolicies.calledOnce).to.be.ok;
    expect(iam.listPolicies.calledWith({
      PathPrefix: 'exampleUsersPath',
    })).to.be.ok;
  });

  it('calls iam.deletePolicy properly', () => {
    expect(iam.deletePolicy.calledTwice).to.be.ok;
    expect(iam.deletePolicy.getCall(0).args).to.eql([
      { PolicyArn: 'examplePolicy1Arn' },
    ]);
    expect(iam.deletePolicy.getCall(1).args).to.eql([
      { PolicyArn: 'examplePolicy2Arn' },
    ]);
  });

  it('calls iam.createPolicy properly', () => {
    expect(iam.createPolicy.calledTwice).to.be.ok;
    expect(iam.createPolicy.getCall(0).args).to.eql([
      {
        PolicyName: 'policy1',
        PolicyDocument: JSON.stringify({ policy1: 'policy1' }),
        Path: 'exampleUsersPath',
      }
    ]);
    expect(iam.createPolicy.getCall(1).args).to.eql([
      {
        PolicyName: 'policy2',
        PolicyDocument: JSON.stringify({ policy2: 'policy2' }),
        Path: 'exampleUsersPath',
      }
    ]);
  });

  it('returns correct results', () => {
    expect(results).to.eql({
      createResult: ['createPolicyResult', 'createPolicyResult'],
      deleteResult: ['deletePolicyResult', 'deletePolicyResult'],
    });
  });
});
