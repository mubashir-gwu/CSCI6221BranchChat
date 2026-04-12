import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { TokenUsage } from '@/models/TokenUsage';
import { logger } from '@/lib/logger';

export async function GET() {
  const requestId = crypto.randomUUID();
  const route = '/api/token-usage';
  const start = Date.now();

  logger.info('Route entered', { context: { route, method: 'GET', requestId } });

  const session = await auth();
  if (!session?.user?.id) {
    logger.warn('Unauthorized request', { context: { route, method: 'GET', requestId } });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    const usage = await TokenUsage.find({ userId: session.user.id }).lean();

    logger.info('Route completed', { context: { route, method: 'GET', userId: session.user.id, requestId }, status: 200, durationMs: Date.now() - start });
    return NextResponse.json({
      usage: usage.map((u: any) => ({
        model: u.model,
        provider: u.provider,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        callCount: u.callCount,
        webSearchRequests: u.webSearchRequests ?? 0,
      })),
    });
  } catch (err: any) {
    logger.error('Route error', { context: { route, method: 'GET', userId: session.user.id, requestId }, error: err?.message, stack: err?.stack });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
