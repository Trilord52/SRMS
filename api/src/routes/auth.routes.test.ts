import type { Express } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { UserModel } from '../models/User';
import { authHeader, seedUser, type SeededUser } from '../test/factories';

let memoryServer: MongoMemoryServer;
let app: Express;

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('srms_auth_test'));
  app = createApp();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await memoryServer.stop();
});

const validRegistration = {
  firstName: 'Alem',
  lastName: 'Bekele',
  userId: 'STAFF-9001',
  email: 'alem.bekele@bankofabyssinia.com',
  password: 'a-long-enough-password',
  role: 'staff' as const,
};

describe('POST /api/v1/auth/register', () => {
  it('creates an account that waits for approval', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validRegistration);

    expect(res.status).toBe(201);
    expect(res.body.user.accountStatus).toBe('pending');
    expect(res.body.user.isApproved).toBe(false);
  });

  it('never returns the password hash', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validRegistration);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('$2');
  });

  it('refuses an email outside the corporate domain', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'alem@gmail.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.some((d: { path: string }) => d.path === 'email')).toBe(true);
  });

  it('refuses a password shorter than the policy', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, password: 'short' });

    expect(res.status).toBe(400);
  });

  it('will not let a registration claim the manager role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, role: 'manager' });

    // The legacy API accepted this and auto-approved the account.
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email differing only in case', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...validRegistration,
        userId: 'STAFF-9002',
        email: validRegistration.email.toUpperCase(),
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a duplicate userId', async () => {
    await request(app).post('/api/v1/auth/register').send(validRegistration);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validRegistration, email: 'other.person@bankofabyssinia.com' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('issues a token for an approved account', async () => {
    const staff = await seedUser(app, 'staff');
    expect(staff.token).toBeTruthy();
  });

  it('gives the same answer for a wrong password and an unknown address', async () => {
    const staff = await seedUser(app, 'staff');

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: 'not-the-password' });

    const unknownUser = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@bankofabyssinia.com', password: 'anything-at-all' });

    // Identical status and message, so the endpoint cannot be used to discover
    // which addresses have accounts.
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('refuses a pending account with a distinguishable code', async () => {
    const pending = await seedUser(app, 'staff', { accountStatus: 'pending' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: pending.email, password: pending.password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
  });

  it('returns the reason when a rejected account tries to sign in', async () => {
    const rejected = await seedUser(app, 'staff', { accountStatus: 'rejected' });
    await UserModel.updateOne({ _id: rejected.id }, { rejectionReason: 'Not a current employee' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: rejected.email, password: rejected.password });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_REJECTED');
    expect(res.body.error.meta.rejectionReason).toBe('Not a current employee');
  });

  it('accepts the email in any case', async () => {
    const staff = await seedUser(app, 'staff');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: staff.email.toUpperCase(), password: staff.password });

    expect(res.status).toBe(200);
  });
});

describe('authentication middleware', () => {
  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed authorization header', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects a token signed with a different secret', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ4In0.wrong');

    expect(res.status).toBe(401);
  });
});

describe('authorization matrix', () => {
  let staff: SeededUser;
  let supervisor: SeededUser;
  let manager: SeededUser;

  beforeEach(async () => {
    staff = await seedUser(app, 'staff');
    supervisor = await seedUser(app, 'supervisor');
    manager = await seedUser(app, 'manager');
  });

  it.each([
    ['GET', '/api/v1/auth/users', 'staff', 403],
    ['GET', '/api/v1/auth/users', 'supervisor', 200],
    ['GET', '/api/v1/auth/users', 'manager', 200],
    ['GET', '/api/v1/auth/registrations/pending', 'staff', 403],
    ['GET', '/api/v1/auth/registrations/pending', 'supervisor', 403],
    ['GET', '/api/v1/auth/registrations/pending', 'manager', 200],
  ])('%s %s as %s gives %i', async (method, path, role, expected) => {
    const actor = { staff, supervisor, manager }[role as 'staff' | 'supervisor' | 'manager'];
    const res = await request(app)
      .get(path)
      .set(authHeader(actor));

    expect(res.status).toBe(expected);
  });

  it('limits a supervisor to staff accounts', async () => {
    const res = await request(app).get('/api/v1/auth/users').set(authHeader(supervisor));

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThan(0);
    expect(res.body.users.every((u: { role: string }) => u.role === 'staff')).toBe(true);
  });

  it('shows a manager every role', async () => {
    const res = await request(app).get('/api/v1/auth/users').set(authHeader(manager));
    const roles = new Set(res.body.users.map((u: { role: string }) => u.role));
    expect(roles.has('manager')).toBe(true);
  });
});

describe('registration approval', () => {
  it('lets a manager approve a pending registration', async () => {
    const manager = await seedUser(app, 'manager');
    await request(app).post('/api/v1/auth/register').send(validRegistration);
    const pending = await UserModel.findOne({ email: validRegistration.email });

    const res = await request(app)
      .patch(`/api/v1/auth/registrations/${pending!._id.toString()}`)
      .set(authHeader(manager))
      .send({ decision: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.user.accountStatus).toBe('approved');

    // The account can now sign in, which is the point of approving it.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: validRegistration.email, password: validRegistration.password });
    expect(login.status).toBe(200);
  });

  it('requires a reason to reject', async () => {
    const manager = await seedUser(app, 'manager');
    await request(app).post('/api/v1/auth/register').send(validRegistration);
    const pending = await UserModel.findOne({ email: validRegistration.email });

    const res = await request(app)
      .patch(`/api/v1/auth/registrations/${pending!._id.toString()}`)
      .set(authHeader(manager))
      .send({ decision: 'rejected' });

    expect(res.status).toBe(400);
  });

  it('will not decide the same registration twice', async () => {
    const manager = await seedUser(app, 'manager');
    await request(app).post('/api/v1/auth/register').send(validRegistration);
    const pending = await UserModel.findOne({ email: validRegistration.email });
    const url = `/api/v1/auth/registrations/${pending!._id.toString()}`;

    await request(app).patch(url).set(authHeader(manager)).send({ decision: 'approved' });
    const second = await request(app)
      .patch(url)
      .set(authHeader(manager))
      .send({ decision: 'rejected', rejectionReason: 'Changed my mind' });

    expect(second.status).toBe(409);
  });

  it('refuses a malformed user id rather than crashing', async () => {
    const manager = await seedUser(app, 'manager');
    const res = await request(app)
      .patch('/api/v1/auth/registrations/not-an-object-id')
      .set(authHeader(manager))
      .send({ decision: 'approved' });

    expect(res.status).toBe(400);
  });
});

describe('password management', () => {
  it('lets a user change their own password and invalidates the old one', async () => {
    const staff = await seedUser(app, 'staff');

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(staff))
      .send({ currentPassword: staff.password, newPassword: 'a-brand-new-password' });

    expect(change.status).toBe(200);

    const oldPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: staff.password });
    expect(oldPassword.status).toBe(401);

    const newPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: staff.email, password: 'a-brand-new-password' });
    expect(newPassword.status).toBe(200);
  });

  it('requires the current password to be correct', async () => {
    const staff = await seedUser(app, 'staff');
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(staff))
      .send({ currentPassword: 'wrong', newPassword: 'a-brand-new-password' });

    expect(res.status).toBe(401);
  });

  it.each([
    ['supervisor', 'staff', 200],
    ['supervisor', 'supervisor', 403],
    ['supervisor', 'manager', 403],
    ['manager', 'staff', 200],
    ['manager', 'supervisor', 200],
    ['manager', 'manager', 403],
  ])('a %s resetting a %s password gives %i', async (actorRole, targetRole, expected) => {
    const actor = await seedUser(app, actorRole as 'supervisor' | 'manager');
    const target = await seedUser(app, targetRole as 'staff' | 'supervisor' | 'manager');

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(authHeader(actor))
      .send({ targetUserId: target.id, newPassword: 'reset-by-an-administrator' });

    expect(res.status).toBe(expected);
  });

  it('does not let staff reset anyone', async () => {
    const staff = await seedUser(app, 'staff');
    const target = await seedUser(app, 'staff');

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .set(authHeader(staff))
      .send({ targetUserId: target.id, newPassword: 'should-not-work-at-all' });

    expect(res.status).toBe(403);
  });
});
