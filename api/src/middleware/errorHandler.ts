import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { config } from '../config/env';
import { AppError, type ErrorBody, type ErrorDetail } from '../lib/errors';

/** Turn a Zod failure into the API's structured detail list. */
export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Terminal error handler. Registered after the routes — Express matches error
 * middleware in registration order, and the legacy server mounted its handler
 * above them, which meant it never ran.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const body = toErrorBody(err);
  const status = statusFor(err);

  // Unexpected failures are worth a log line; deliberate rejections are not.
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json(body);
}

function statusFor(err: unknown): number {
  if (err instanceof AppError) return err.status;
  if (err instanceof ZodError) return 400;
  if (err instanceof MulterError) return err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
  if (err instanceof mongoose.Error.ValidationError) return 400;
  if (err instanceof mongoose.Error.CastError) return 400;
  if (isDuplicateKeyError(err)) return 409;
  return 500;
}

function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof AppError) return err.toBody();

  if (err instanceof ZodError) {
    return {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: zodDetails(err),
      },
    };
  }

  if (err instanceof MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return {
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_FAILED',
        message: tooLarge
          ? `Uploaded file exceeds the ${config.MAX_UPLOAD_BYTES} byte limit`
          : `Upload rejected: ${err.message}`,
        details: err.field ? [{ path: err.field, message: err.code }] : undefined,
      },
    };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: Object.entries(err.errors).map(([path, issue]) => ({
          path,
          message: issue.message,
        })),
      },
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return {
      error: {
        code: 'VALIDATION_FAILED',
        message: `Malformed value for ${err.path}`,
        details: [{ path: err.path, message: `Expected a valid ${err.kind}` }],
      },
    };
  }

  if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
    return {
      error: {
        code: 'CONFLICT',
        message: `That ${field} is already in use`,
        details: [{ path: field, message: 'Already exists' }],
      },
    };
  }

  // Message text of an unexpected failure can carry internal detail, so it is
  // only surfaced outside production.
  return {
    error: {
      code: 'INTERNAL',
      message: config.isProduction
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : String(err),
    },
  };
}

interface DuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is DuplicateKeyError {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Fallback for unmatched routes, so a 404 uses the same envelope as everything else. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.path}`,
    },
  } satisfies ErrorBody);
}
