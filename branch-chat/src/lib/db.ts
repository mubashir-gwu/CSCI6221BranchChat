import mongoose from 'mongoose';
import { logger } from '@/lib/logger';

export class BackendUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BackendUnavailableError';
  }
}

const MONGO_UNREACHABLE_ERROR_NAMES = new Set([
  'BackendUnavailableError',
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
]);

const CONNECTION_ERROR_MESSAGE_PATTERNS = [/ECONNREFUSED/i, /ENOTFOUND/i];

export function isBackendUnavailableError(err: unknown): boolean {
  if (err instanceof BackendUnavailableError) return true;
  if (err && typeof err === 'object') {
    const name = (err as { name?: string }).name;
    if (name && MONGO_UNREACHABLE_ERROR_NAMES.has(name)) return true;
    const message = (err as { message?: string }).message;
    if (message && CONNECTION_ERROR_MESSAGE_PATTERNS.some((p) => p.test(message))) {
      return true;
    }
  }
  return false;
}

export const BACKEND_UNAVAILABLE_RESPONSE = {
  body: { error: 'Backend services are unavailable', code: 'BACKEND_UNAVAILABLE' },
  status: 503,
} as const;

function getMongoURI(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not defined');
  return uri;
}

let cached = (global as any).mongoose;
if (!cached) cached = (global as any).mongoose = { conn: null, promise: null };

const CONNECT_TIMEOUT_MS = 2000;
const FAILURE_BACKOFF_MS = 3000;

export async function connectDB() {
  // If Mongoose's driver reports a dead socket, drop the cached connection so
  // the next caller gets a fresh connect attempt (or a fast-fail via backoff).
  if (cached.conn && mongoose.connection.readyState === 0) {
    cached.conn = null;
    cached.promise = null;
  }
  if (cached.conn) return cached.conn;

  if (cached.lastFailureAt && Date.now() - cached.lastFailureAt < FAILURE_BACKOFF_MS) {
    throw new BackendUnavailableError(cached.lastFailureMessage ?? 'Database unavailable');
  }

  if (!cached.promise) {
    const uri = getMongoURI();
    logger.info('Database: connecting', { uri: uri.replace(/\/\/.*@/, '//***@') });
    cached.promise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
    });
  }
  try {
    cached.conn = await cached.promise;
    cached.lastFailureAt = null;
    cached.lastFailureMessage = null;
    logger.info('Database: connected');
  } catch (err: any) {
    cached.promise = null;
    cached.lastFailureAt = Date.now();
    cached.lastFailureMessage = err?.message ?? 'Failed to connect to MongoDB';
    logger.error('Database: connection failed', { error: err?.message });
    throw new BackendUnavailableError(
      err?.message ?? 'Failed to connect to MongoDB',
      { cause: err }
    );
  }
  return cached.conn;
}
