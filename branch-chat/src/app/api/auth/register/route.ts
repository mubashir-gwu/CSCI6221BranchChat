import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { connectDB, isBackendUnavailableError, BACKEND_UNAVAILABLE_RESPONSE } from '@/lib/db';
import { User } from '@/models/User';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const route = '/api/auth/register';
  const start = Date.now();
  logger.info('Route entered', { context: { route, method: 'POST', requestId } });

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      logger.info('Route completed', { context: { route, method: 'POST', requestId }, status: 400, durationMs: Date.now() - start });
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      logger.info('Route completed', { context: { route, method: 'POST', requestId }, status: 400, durationMs: Date.now() - start });
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    await connectDB();

    const normalizedEmail = (email as string).toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      logger.warn('Registration failed: email exists', { context: { route, requestId }, email: normalizedEmail });
      logger.info('Route completed', { context: { route, method: 'POST', requestId }, status: 409, durationMs: Date.now() - start });
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email: normalizedEmail, hashedPassword });

    logger.info('Registration success', { context: { route, requestId }, email: normalizedEmail, userId: user._id.toString() });
    logger.info('Route completed', { context: { route, method: 'POST', requestId }, status: 201, durationMs: Date.now() - start });
    return NextResponse.json(
      { id: user._id.toString(), email: user.email },
      { status: 201 }
    );
  } catch (err: any) {
    logger.error('Route error', { context: { route, method: 'POST', requestId }, error: err?.message, stack: err?.stack });
    if (isBackendUnavailableError(err)) {
      return NextResponse.json(BACKEND_UNAVAILABLE_RESPONSE.body, { status: BACKEND_UNAVAILABLE_RESPONSE.status });
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
