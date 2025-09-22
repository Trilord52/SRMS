import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { ROLES, type Role } from '../lib/constants';
import { expiredToken, forbidden, invalidToken, unauthenticated } from '../lib/errors';

export interface TokenPayload {
  userId: string;
  role: Role;
  email: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Verifies the bearer token and attaches the principal to the request.
 *
 * The legacy middleware re-read the full user document from the database on
 * every authenticated request. That is a round-trip per call, and the claims in
 * a signed token are already trustworthy; handlers that genuinely need the
 * stored record load it themselves.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');

  if (!header) {
    next(unauthenticated('Authentication required'));
    return;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next(invalidToken('Authorization header must be "Bearer <token>"'));
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof decoded.userId !== 'string' ||
      typeof decoded.email !== 'string' ||
      !isRole(decoded.role)
    ) {
      next(invalidToken('Token payload is missing required claims'));
      return;
    }

    req.auth = { userId: decoded.userId, role: decoded.role, email: decoded.email };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(expiredToken());
      return;
    }
    next(invalidToken());
  }
}

/**
 * Role gate.
 *
 * The legacy implementation repeated `if (req.user.role !== 'manager')` in
 * roughly eighteen handlers, so a handler added without the check simply had no
 * authorisation. Expressing it as middleware makes the omission visible at the
 * route definition.
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(unauthenticated());
      return;
    }

    if (!allowed.includes(req.auth.role)) {
      const list = allowed.join(' or ');
      next(forbidden(`This action requires the ${list} role`));
      return;
    }

    next();
  };
}
