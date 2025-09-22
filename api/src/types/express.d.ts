import type { Role } from '../lib/constants';

/**
 * Request augmentation for the authenticated principal.
 *
 * `auth` is populated by the `authenticate` middleware and is present on every
 * route mounted behind it. Handlers that are not behind it must treat it as
 * possibly undefined.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: Role;
        email: string;
      };
    }
  }
}

export {};
