import cors from 'cors';
import express, { type Express } from 'express';
import { config } from './config/env';
import { isDatabaseConnected } from './db/connect';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';

/**
 * Builds the Express application without starting a listener, so tests can
 * mount it directly. The legacy entry point called listen() at import time and
 * never exported the app, which made it untestable with Supertest.
 */
export function createApp(): Express {
  const app = express();

  // Behind Render's proxy, so the rate limiter sees the real client address.
  app.set('trust proxy', 1);

  app.use(
    cors({
      // An explicit allowlist. The legacy server used cors() with no options,
      // which permits every origin.
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/health', (_req, res) => {
    const connected = isDatabaseConnected();
    res.status(connected ? 200 : 503).json({
      status: connected ? 'ok' : 'degraded',
      database: connected ? 'connected' : 'disconnected',
    });
  });

  app.use('/api/v1/auth', authRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
