/**
 * One error shape for the whole API.
 *
 * The legacy implementation returned three different bodies — `{ message }`,
 * `{ message, error }`, and a bare `Forbidden` string — so clients had to match
 * on message text to tell failures apart. Every error now carries a stable
 * machine-readable `code`, and details are only ever added as structured data.
 */

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'ACCOUNT_PENDING',
  'ACCOUNT_REJECTED',
  'INVALID_CREDENTIALS',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorDetail {
  /** Dotted path to the offending field, e.g. `templateData.incidentCount`. */
  path: string;
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    /** Extra context that is safe to show a client, e.g. rejectionReason. */
    meta?: Record<string, unknown>;
  };
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];
  readonly meta?: Record<string, unknown>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetail[]; meta?: Record<string, unknown> }
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (options?.details) this.details = options.details;
    if (options?.meta) this.meta = options.meta;
    Error.captureStackTrace?.(this, AppError);
  }

  toBody(): ErrorBody {
    const error: ErrorBody['error'] = { code: this.code, message: this.message };
    if (this.details) error.details = this.details;
    if (this.meta) error.meta = this.meta;
    return { error };
  }
}

export const badRequest = (message: string, details?: ErrorDetail[]) =>
  new AppError(400, 'VALIDATION_FAILED', message, details ? { details } : undefined);

export const unauthenticated = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const invalidToken = (message = 'Invalid or malformed token') =>
  new AppError(401, 'TOKEN_INVALID', message);

export const expiredToken = (message = 'Token has expired') =>
  new AppError(401, 'TOKEN_EXPIRED', message);

/**
 * Login failures deliberately share one message so the response cannot be used
 * to discover which email addresses exist.
 */
export const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (resource = 'Resource') =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export const payloadTooLarge = (message: string) =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', message);

export const internal = (message = 'Internal server error') =>
  new AppError(500, 'INTERNAL', message);
