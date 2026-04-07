import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { getAvailableProviders } from '@/lib/providers/availability';
import { logger } from '@/lib/logger';

export async function GET() {
  const requestId = crypto.randomUUID();
  const route = '/api/providers';
  const start = Date.now();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  logger.info('Route entered', { context: { route, method: 'GET', userId: session.user.id, requestId } });

  const providers = getAvailableProviders();

  logger.info('Route completed', { context: { route, method: 'GET', userId: session.user.id, requestId }, status: 200, providerCount: providers.length, durationMs: Date.now() - start });
  return NextResponse.json({ providers });
}
