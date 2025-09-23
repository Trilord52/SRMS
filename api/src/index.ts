import { createApp } from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './db/connect';

async function main(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    console.log(`API listening on port ${config.PORT} (${config.NODE_ENV})`);
  });

  // Finish in-flight requests before exiting so a deploy does not drop them.
  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      void disconnectDatabase().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
