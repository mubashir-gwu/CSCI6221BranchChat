import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB, isBackendUnavailableError, BACKEND_UNAVAILABLE_RESPONSE } from '@/lib/db';

const PING_TIMEOUT_MS = 2000;

export async function GET() {
  try {
    await connectDB();
    // connectDB short-circuits on cached.conn, so explicitly probe the live
    // connection to detect a DB that died after the initial connect.
    const db = mongoose.connection?.db;
    if (!db) {
      return NextResponse.json(BACKEND_UNAVAILABLE_RESPONSE.body, { status: BACKEND_UNAVAILABLE_RESPONSE.status });
    }
    await Promise.race([
      db.admin().ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health ping timed out')), PING_TIMEOUT_MS)
      ),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isBackendUnavailableError(err)) {
      return NextResponse.json(BACKEND_UNAVAILABLE_RESPONSE.body, { status: BACKEND_UNAVAILABLE_RESPONSE.status });
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
