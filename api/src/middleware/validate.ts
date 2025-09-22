import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../lib/errors';
import { zodDetails } from './errorHandler';

type Source = 'body' | 'query' | 'params';

/**
 * Parses one part of the request through a Zod schema and replaces it with the
 * parsed result, so handlers receive coerced, typed values rather than raw
 * strings. Failures become a 400 carrying a field-by-field detail list.
 */
export function validate<T>(source: Source, schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(
        badRequest(
          `Invalid request ${source}`,
          zodDetails(result.error)
        )
      );
      return;
    }

    // Express 5 exposes req.query through a getter, so assigning to it directly
    // throws. Storing parsed values separately keeps handlers type-safe.
    if (source === 'query') {
      (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    } else {
      req[source] = result.data as never;
    }

    next();
  };
}

/** Retrieve the value stored by `validate('query', …)`. */
export function validatedQuery<T>(req: Request): T {
  return (req as Request & { validatedQuery: T }).validatedQuery;
}
