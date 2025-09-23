import mongoose from 'mongoose';
import { config } from '../config/env';

/**
 * Connects to MongoDB with a bounded retry.
 *
 * The legacy server called process.exit(1) on the first connection failure, so
 * a transient network blip during startup killed the container instead of
 * letting it come back.
 */
export async function connectDatabase(attempts = 5): Promise<void> {
  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await mongoose.connect(config.MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
      });
      console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const last = attempt === attempts;

      if (last) {
        throw new Error(`Could not connect to MongoDB after ${attempts} attempts: ${message}`);
      }

      const backoffMs = Math.min(1_000 * 2 ** (attempt - 1), 10_000);
      console.warn(`MongoDB connection attempt ${attempt} failed, retrying in ${backoffMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}

/** True when the driver reports an established connection. */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
