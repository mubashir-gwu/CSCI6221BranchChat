import mongoose from 'mongoose';
import { logger } from '@/lib/logger';

function getMongoURI(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not defined');
  return uri;
}

let cached = (global as any).mongoose;
if (!cached) cached = (global as any).mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    const uri = getMongoURI();
    logger.info('Database: connecting', { uri: uri.replace(/\/\/.*@/, '//***@') });
    cached.promise = mongoose.connect(uri);
  }
  try {
    cached.conn = await cached.promise;
    logger.info('Database: connected');
  } catch (err: any) {
    cached.promise = null;
    logger.error('Database: connection failed', { error: err?.message });
    throw err;
  }
  return cached.conn;
}
