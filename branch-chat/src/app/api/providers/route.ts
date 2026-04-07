import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { getAvailableProviders } from '@/lib/providers/availability';
import { logger } from '@/lib/logger';

export async function GET() {
  const requestId = crypto.randomUUID();
  const route = '/api/providers';
  const start = Date.now();

  logger.info('Route entered', { context: { route, method: 'GET', requestId } });

  const session = await auth();
  if (!session?.user?.id) {
    logger.warn('Unauthorized request', { context: { route, method: 'GET', requestId } });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const providers = getAvailableProviders();

    logger.info('Route completed', { context: { route, method: 'GET', userId: session.user.id, requestId }, status: 200, providerCount: providers.length, durationMs: Date.now() - start });
    return NextResponse.json({ providers });
  } catch (err: any) {
    logger.error('Route error', { context: { route, method: 'GET', userId: session.user.id, requestId }, error: err?.message, stack: err?.stack });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
