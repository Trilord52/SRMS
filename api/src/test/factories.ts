import type { Express } from 'express';
import request from 'supertest';
import { UserModel } from '../models/User';
import { hashPassword } from '../lib/password';
import type { Role } from '../lib/constants';

export interface SeededUser {
  id: string;
  email: string;
  password: string;
  role: Role;
  token: string;
}

const PASSWORD = 'correct-horse-battery';

/**
 * Creates an approved account of the given role and signs it in through the
 * real login endpoint, so tests exercise the same path a client would.
 */
export async function seedUser(
  app: Express,
  role: Role,
  overrides: Partial<{ email: string; userId: string; accountStatus: string }> = {}
): Promise<SeededUser> {
  const email = overrides.email ?? `${role}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@bankofabyssinia.com`;
  const userId = overrides.userId ?? `${role.toUpperCase()}-${Math.random().toString(36).slice(2, 8)}`;

  const user = await UserModel.create({
    firstName: role,
    lastName: 'Test',
    userId,
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
    accountStatus: overrides.accountStatus ?? 'approved',
  });

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  return {
    id: user._id.toString(),
    email,
    password: PASSWORD,
    role,
    token: response.body?.token ?? '',
  };
}

export const authHeader = (user: SeededUser) => ({ Authorization: `Bearer ${user.token}` });

export { PASSWORD };
