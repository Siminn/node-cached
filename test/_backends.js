'use strict';

const { defaults } = require('lodash');

const Cache = require('../lib/cache');

const backendOptions = {
  memcached: {
    hosts: `${process.env.MEMCACHED__HOST || '127.0.0.1'}:11211`,
  },
  mongodb: {
    url: `${process.env.MONGODB_URL || 'mongodb://localhost/testdb'}`,
    collectionName: '__testcache',
  },
};

module.exports = function withBackends(createTestCases) {
  ['mongodb', 'memory', 'memcached'].forEach(backendType => {
    describe(`with backend "${backendType}"`, () => {
      const cache = new Cache({
        backend: defaults({ type: backendType }, backendOptions[backendType]),
        name: 'awesome-name',
        debug: true,
      });
      after(() => cache.end());

      createTestCases(cache);
    });
  });
};
