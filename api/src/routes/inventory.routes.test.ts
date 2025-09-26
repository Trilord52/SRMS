import type { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { authHeader, seedUser, type SeededUser } from '../test/factories';

let memoryServer: MongoMemoryServer;
let app: Express;
let staff: SeededUser;
let supervisor: SeededUser;
let manager: SeededUser;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('srms_inventory_test'));
  app = createApp();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );
  staff = await seedUser(app, 'staff');
  supervisor = await seedUser(app, 'supervisor');
  manager = await seedUser(app, 'manager');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await memoryServer.stop();
});

const validDatabase = {
  name: 'FinanceDB',
  databaseType: 'PostgreSQL',
  host: '10.0.0.42',
  dbVersion: '16.1',
  osVersion: 'Ubuntu 24.04',
  customFeatures: [
    { name: 'replicaCount', type: 'number', label: 'Replica count', required: true },
    { name: 'tier', type: 'enum', label: 'Tier', enumOptions: ['gold', 'silver'] },
  ],
};

const createDatabase = async (body: object = validDatabase) => {
  const res = await request(app).post('/api/v1/databases').set(authHeader(manager)).send(body);
  return res;
};

describe('database inventory', () => {
  it('lets a manager create a record', async () => {
    const res = await createDatabase();
    expect(res.status).toBe(201);
    expect(res.body.database.name).toBe('FinanceDB');
    expect(res.body.database.isActive).toBe(true);
  });

  it.each([
    ['staff', 403],
    ['supervisor', 403],
  ])('refuses creation by %s', async (role, expected) => {
    const actor = role === 'staff' ? staff : supervisor;
    const res = await request(app)
      .post('/api/v1/databases')
      .set(authHeader(actor))
      .send(validDatabase);

    expect(res.status).toBe(expected);
  });

  it.each([
    ['an IPv4 address', '192.168.1.10', 201],
    ['an IPv6 address', '2001:db8::1', 201],
    ['a hostname', 'db-primary.example.com', 201],
    ['a sentence', 'ask Alem for the address', 400],
    ['an empty value', '', 400],
  ])('validates the host: %s', async (_label, host, expected) => {
    // The legacy schema stored this as free text, so anything at all could sit
    // in a field the interface presents as an address.
    const res = await createDatabase({ ...validDatabase, host });
    expect(res.status).toBe(expected);
  });

  it('requires options on an enum feature', async () => {
    const res = await createDatabase({
      ...validDatabase,
      customFeatures: [{ name: 'tier', type: 'enum', label: 'Tier', enumOptions: [] }],
    });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate name', async () => {
    await createDatabase();
    const res = await createDatabase();
    expect(res.status).toBe(409);
  });

  it('retires rather than deletes, so reporting history keeps its reference', async () => {
    const created = await createDatabase();
    const id = created.body.database._id;

    const res = await request(app).delete(`/api/v1/databases/${id}`).set(authHeader(manager));

    expect(res.status).toBe(200);
    expect(res.body.database.isActive).toBe(false);

    // The record still exists for a manager to see.
    const fetched = await request(app).get(`/api/v1/databases/${id}`).set(authHeader(manager));
    expect(fetched.status).toBe(200);
  });

  it('will not retire the same record twice', async () => {
    const created = await createDatabase();
    const id = created.body.database._id;

    await request(app).delete(`/api/v1/databases/${id}`).set(authHeader(manager));
    const second = await request(app).delete(`/api/v1/databases/${id}`).set(authHeader(manager));

    expect(second.status).toBe(409);
  });

  it('restores a retired record', async () => {
    const created = await createDatabase();
    const id = created.body.database._id;
    await request(app).delete(`/api/v1/databases/${id}`).set(authHeader(manager));

    const res = await request(app)
      .post(`/api/v1/databases/${id}/restore`)
      .set(authHeader(manager));

    expect(res.status).toBe(200);
    expect(res.body.database.isActive).toBe(true);
  });

  it('hides retired records from non-managers', async () => {
    const created = await createDatabase();
    await request(app)
      .delete(`/api/v1/databases/${created.body.database._id}`)
      .set(authHeader(manager));

    const staffView = await request(app).get('/api/v1/databases').set(authHeader(staff));
    expect(staffView.body.databases).toHaveLength(0);

    const managerView = await request(app)
      .get('/api/v1/databases?isActive=false')
      .set(authHeader(manager));
    expect(managerView.body.databases).toHaveLength(1);
  });

  it('retires several records at once', async () => {
    const first = await createDatabase();
    const second = await createDatabase({ ...validDatabase, name: 'HrDB' });

    // The legacy route declared DELETE /bulk-delete after DELETE /:id, so
    // "bulk-delete" was parsed as an id and the endpoint was unreachable.
    const res = await request(app)
      .post('/api/v1/databases/bulk-retire')
      .set(authHeader(manager))
      .send({ databaseIds: [first.body.database._id, second.body.database._id] });

    expect(res.status).toBe(200);
    expect(res.body.retiredCount).toBe(2);
  });

  it('rejects a bulk request with no ids', async () => {
    const res = await request(app)
      .post('/api/v1/databases/bulk-retire')
      .set(authHeader(manager))
      .send({ databaseIds: [] });

    expect(res.status).toBe(400);
  });

  it('rejects a malformed id rather than returning a server error', async () => {
    const res = await request(app)
      .get('/api/v1/databases/not-an-id')
      .set(authHeader(manager));

    // The legacy handler passed this straight to findById, producing a 500.
    expect(res.status).toBe(400);
  });
});

describe('analytics access', () => {
  it.each([
    ['/api/v1/analytics/overview'],
    ['/api/v1/analytics/by-submitter'],
    ['/api/v1/analytics/by-template'],
  ])('refuses staff at %s', async (path) => {
    const res = await request(app).get(path).set(authHeader(staff));
    expect(res.status).toBe(403);
  });

  it.each([
    ['/api/v1/analytics/overview'],
    ['/api/v1/analytics/by-submitter'],
    ['/api/v1/analytics/by-template'],
  ])('allows a supervisor at %s', async (path) => {
    const res = await request(app).get(path).set(authHeader(supervisor));
    expect(res.status).toBe(200);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/analytics/overview');
    expect(res.status).toBe(401);
  });
});

describe('analytics overview', () => {
  it('returns a bounded default range rather than everything', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set(authHeader(manager));

    expect(res.status).toBe(200);
    // The legacy endpoint fell through to an empty filter when no range was
    // given, aggregating every report ever submitted.
    const from = new Date(res.body.range.from).getTime();
    const to = new Date(res.body.range.to).getTime();
    const spanDays = (to - from) / 86_400_000;
    expect(spanDays).toBeGreaterThan(29);
    expect(spanDays).toBeLessThan(31);
  });

  it('rejects a range where from is after to', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview?from=2026-06-01&to=2026-01-01')
      .set(authHeader(manager));

    expect(res.status).toBe(400);
  });

  it('reports zeros and a null approval rate for an empty range', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview?from=2026-01-01&to=2026-01-31')
      .set(authHeader(manager));

    expect(res.body.totals).toEqual({ reports: 0, pending: 0, approved: 0, rejected: 0 });
    // Null rather than zero: nothing decided is not the same as nothing approved.
    expect(res.body.metrics.approvalRatePercent).toBeNull();
    expect(res.body.metrics.averageReviewHours).toBeNull();
  });

  it('covers the requested range with trend buckets', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview?from=2026-03-02&to=2026-03-09&granularity=day')
      .set(authHeader(manager));

    expect(res.body.trend).toHaveLength(7);
    expect(res.body.trend[0].label).toBe('2026-03-02');
  });

  it('groups by template under a name that says so', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/by-template')
      .set(authHeader(manager));

    // The legacy response called this "databasePerformance" while grouping by
    // template name, which made the figure easy to misread.
    expect(res.body).toHaveProperty('templates');
    expect(res.body).not.toHaveProperty('databasePerformance');
  });
});
