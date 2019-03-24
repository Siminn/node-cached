/*
 * Copyright (c) 2014, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const MongoClient = require('mongodb').MongoClient;
const Bluebird = require('bluebird');
const util = require('../util');

const debug = require('debug')('cached-mongodb');

async function createClient(options) {
  const collectionName = options.collectionName || '_cache';

  let client = options.client;

  if (!client) {
    const url = options.url || 'mongodb://127.0.0.1/test';
    client = await MongoClient.connect(url, {
      useNewUrlParser: true,
    });
    // eslint-disable-next-line no-console
    console.log(
      `Successfully connected cached to mongodb backend @ ${url}, collection ${collectionName}`
    );
  }

  const db = client.db();
  const collection = db.collection(collectionName);

  return {
    collection,
    close: async () => client.close(),
  };
}

function MongodbBackend(options) {
  this.type = 'mongodb';
  this.client = createClient(options);
}
module.exports = MongodbBackend;

MongodbBackend.prototype.get = function get(key) {
  debug('Fetching', key, 'from mongodb');
  return Bluebird.resolve(this.client).then(client => {
    return client.collection
      .findOne({
        k: key,
      })
      .then(wrappedValue => {
        wrappedValue = wrappedValue || null;
        if (util.isExpired(wrappedValue && wrappedValue.e.getTime())) {
          wrappedValue = null;
        }

        if (wrappedValue === null) debug('got null for', key);
        else debug('got value for', key);

        return wrappedValue ? wrappedValue.d : null;
      });
  });
};

MongodbBackend.prototype.set = function set(key, value, options) {
  debug('setting value for', key);
  return Bluebird.resolve(this.client).then(client => {
    return client.collection
      .replaceOne(
        {
          k: key,
        },
        {
          k: key,
          d: value,
          e: new Date(util.expiresAt(options.expire)),
        },
        { upsert: true }
      )
      .then(() => value);
  });
};

MongodbBackend.prototype.unset = function unset(key) {
  debug('deleting value for', key);
  return Bluebird.resolve(this.client).then(client => {
    return client.collection.deleteOne({ k: key }).then(() => undefined);
  });
};

MongodbBackend.prototype.end = async function end() {
  const client = await this.client;
  client.close();
  //return Bluebird.resolve(this.client).then(client => client.client.close());
};
