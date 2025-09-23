import bcrypt from 'bcryptjs';

/**
 * Password hashing, isolated so the cost factor is set in one place and can be
 * lowered in tests without touching call sites.
 */
const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
