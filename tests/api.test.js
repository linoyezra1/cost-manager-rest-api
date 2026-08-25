/**
 * Comprehensive unit / integration tests for all Cost Manager endpoints.
 * Uses an in-memory MongoDB so tests do not touch Atlas.
 *
 * Run from cost-manager root (after npm run install:all):
 *   npm test
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

// Hold the memory server and service apps
let memoryServer;
let logsApp;
let usersApp;
let costsApp;
let aboutApp;
let logsMongoose;
let usersMongoose;
let costsMongoose;
let aboutMongoose;

/**
 * Connect a service's own mongoose instance to the memory URI.
 */
async function connectServiceMongoose(serviceFolder, uri) {
  // Load the mongoose copy installed inside that microservice
  const mongoose = require(path.join(__dirname, '..', serviceFolder, 'node_modules', 'mongoose'));
  await mongoose.connect(uri);
  return mongoose;
}

before(async function setup() {
  // Start an ephemeral MongoDB for isolated testing
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();
  process.env.MONGODB_URI = uri;

  // Team member env vars for about-service
  process.env.TEAM_MEMBER_1_FIRST = 'Linoy';
  process.env.TEAM_MEMBER_1_LAST = 'Ezra';
  process.env.TEAM_MEMBER_2_FIRST = 'Dudu';
  process.env.TEAM_MEMBER_2_LAST = 'Dorani';

  // Connect each service mongoose, then require its Express app
  logsMongoose = await connectServiceMongoose('logs-service', uri);
  logsApp = require('../logs-service/server');

  usersMongoose = await connectServiceMongoose('users-service', uri);
  usersApp = require('../users-service/server');

  costsMongoose = await connectServiceMongoose('costs-service', uri);
  costsApp = require('../costs-service/server');

  aboutMongoose = await connectServiceMongoose('about-service', uri);
  aboutApp = require('../about-service/server');
});

after(async function teardown() {
  // Disconnect all mongoose instances and stop memory MongoDB
  if (logsMongoose) await logsMongoose.disconnect();
  if (usersMongoose) await usersMongoose.disconnect();
  if (costsMongoose) await costsMongoose.disconnect();
  if (aboutMongoose) await aboutMongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

beforeEach(async function resetData() {
  // Clear collections between tests using the users-service models connection
  const User = usersMongoose.model('User');
  const Cost = usersMongoose.models.Cost || costsMongoose.model('Cost');
  const Log = logsMongoose.model('Log');
  const Report = costsMongoose.models.Report || costsMongoose.model('Report');

  await User.deleteMany({});
  await Cost.deleteMany({});
  await Log.deleteMany({});
  await Report.deleteMany({});

  // Seed the required imaginary user for most happy-path tests
  await User.create({
    id: 123123,
    first_name: 'mosh',
    last_name: 'israeli',
    birthday: new Date('1990-01-01')
  });
});

/* -------------------- Process D: About -------------------- */

describe('GET /api/about (about-service)', function () {
  it('returns team members with first_name and last_name only', async function () {
    const res = await request(aboutApp).get('/api/about/');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].first_name, 'Linoy');
    assert.equal(res.body[0].last_name, 'Ezra');
    assert.equal(Object.keys(res.body[0]).length, 2);
  });
});

/* -------------------- Process B: Users -------------------- */

describe('POST /api/add (users-service)', function () {
  it('creates a new user and returns the document', async function () {
    const res = await request(usersApp)
      .post('/api/add/')
      .send({
        id: 555,
        first_name: 'dana',
        last_name: 'cohen',
        birthday: '1995-05-05'
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.id, 555);
    assert.equal(res.body.first_name, 'dana');
    assert.equal(res.body.last_name, 'cohen');
  });

  it('rejects duplicate user id with error JSON', async function () {
    const res = await request(usersApp)
      .post('/api/add/')
      .send({
        id: 123123,
        first_name: 'other',
        last_name: 'person',
        birthday: '1991-01-01'
      });
    assert.equal(res.status, 409);
    assert.ok(res.body.id);
    assert.ok(res.body.message);
  });

  it('rejects missing fields with error JSON', async function () {
    const res = await request(usersApp).post('/api/add/').send({ id: 1 });
    assert.equal(res.status, 400);
    assert.ok(res.body.id);
    assert.ok(res.body.message);
  });
});

describe('GET /api/users (users-service)', function () {
  it('lists all users', async function () {
    const res = await request(usersApp).get('/api/users');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, 123123);
    assert.equal(res.body[0].first_name, 'mosh');
  });
});

describe('GET /api/users/:id (users-service)', function () {
  it('returns user details with total costs', async function () {
    // Add two costs for the user via the costs model
    const Cost = costsMongoose.model('Cost');
    await Cost.create([
      { description: 'a', category: 'food', userid: 123123, sum: 10, created_at: new Date() },
      { description: 'b', category: 'health', userid: 123123, sum: 5.5, created_at: new Date() }
    ]);

    const res = await request(usersApp).get('/api/users/123123');
    assert.equal(res.status, 200);
    assert.equal(res.body.first_name, 'mosh');
    assert.equal(res.body.last_name, 'israeli');
    assert.equal(res.body.id, 123123);
    assert.equal(res.body.total, 15.5);
  });

  it('returns error JSON when user is missing', async function () {
    const res = await request(usersApp).get('/api/users/999999');
    assert.equal(res.status, 404);
    assert.ok(res.body.id);
    assert.ok(res.body.message);
  });
});

/* -------------------- Process C: Costs -------------------- */

describe('POST /api/add (costs-service)', function () {
  it('adds a cost item for an existing user', async function () {
    const res = await request(costsApp)
      .post('/api/add/')
      .send({
        userid: 123123,
        description: 'milk 9',
        category: 'food',
        sum: 8
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.description, 'milk 9');
    assert.equal(res.body.category, 'food');
    assert.equal(res.body.userid, 123123);
    assert.equal(res.body.sum, 8);
  });

  it('rejects invalid category', async function () {
    const res = await request(costsApp)
      .post('/api/add/')
      .send({
        userid: 123123,
        description: 'x',
        category: 'travel',
        sum: 1
      });
    assert.equal(res.status, 400);
    assert.ok(res.body.id);
    assert.ok(res.body.message);
  });

  it('rejects unknown userid', async function () {
    const res = await request(costsApp)
      .post('/api/add/')
      .send({
        userid: 42,
        description: 'x',
        category: 'food',
        sum: 1
      });
    assert.equal(res.status, 404);
    assert.ok(res.body.id);
    assert.ok(res.body.message);
  });

  it('rejects past dates', async function () {
    const res = await request(costsApp)
      .post('/api/add/')
      .send({
        userid: 123123,
        description: 'old',
        category: 'food',
        sum: 1,
        created_at: '2020-01-01'
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.id, 'PAST_DATE_NOT_ALLOWED');
  });
});

describe('GET /api/report (costs-service)', function () {
  it('returns empty category arrays when there are no costs', async function () {
    const res = await request(costsApp).get('/api/report/?id=123123&year=2026&month=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.userid, 123123);
    assert.equal(res.body.year, 2026);
    assert.equal(res.body.month, 1);
    assert.ok(Array.isArray(res.body.costs));
    assert.equal(res.body.costs.length, 5);

    // Every category key must appear, even if empty
    const keys = res.body.costs.map(function (obj) {
      return Object.keys(obj)[0];
    });
    assert.deepEqual(keys, ['food', 'education', 'health', 'housing', 'sport']);
  });

  it('groups costs by category with sum, description and day', async function () {
    const Cost = costsMongoose.model('Cost');
    // Use current month/year so caching path is not required for this assertion
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    await Cost.create({
      description: 'choco',
      category: 'food',
      userid: 123123,
      sum: 12,
      created_at: new Date(year, month - 1, 17)
    });

    const res = await request(costsApp).get('/api/report/?id=123123&year=' + year + '&month=' + month);
    assert.equal(res.status, 200);

    const foodEntry = res.body.costs.find(function (c) {
      return Object.prototype.hasOwnProperty.call(c, 'food');
    });
    assert.ok(foodEntry);
    assert.equal(foodEntry.food.length, 1);
    assert.equal(foodEntry.food[0].sum, 12);
    assert.equal(foodEntry.food[0].description, 'choco');
    assert.equal(foodEntry.food[0].day, 17);
  });

  it('caches past-month reports (Computed Design Pattern)', async function () {
    const Cost = costsMongoose.model('Cost');
    const Report = costsMongoose.model('Report');

    // Use a clearly past month
    await Cost.create({
      description: 'old book',
      category: 'education',
      userid: 123123,
      sum: 50,
      created_at: new Date(2020, 0, 10)
    });

    const first = await request(costsApp).get('/api/report/?id=123123&year=2020&month=1');
    assert.equal(first.status, 200);

    // A cached document should now exist
    const cached = await Report.findOne({ userid: 123123, year: 2020, month: 1 });
    assert.ok(cached);

    // Second request should still succeed (served from cache)
    const second = await request(costsApp).get('/api/report/?id=123123&year=2020&month=1');
    assert.equal(second.status, 200);
    assert.deepEqual(second.body.costs, first.body.costs);
  });

  it('rejects invalid month with error JSON', async function () {
    const res = await request(costsApp).get('/api/report/?id=123123&year=2026&month=13');
    assert.equal(res.status, 400);
    assert.ok(res.body.id);
    assert.ok(res.body.message);
  });
});

/* -------------------- Process A: Logs -------------------- */

describe('GET /api/logs (logs-service)', function () {
  it('returns an array of log documents written by Pino', async function () {
    // Trigger a request so the logger middleware writes at least one log
    await request(aboutApp).get('/api/about/');

    // Give the async log write a brief moment to flush into MongoDB
    await new Promise(function (resolve) {
      setTimeout(resolve, 400);
    });

    const res = await request(logsApp).get('/api/logs');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    assert.ok(res.body[0].message);
    assert.ok(res.body[0].level);
  });
});
