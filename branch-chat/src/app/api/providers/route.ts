import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAvailableProviders } from '@/lib/providers/availability';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providers = getAvailableProviders();

  return NextResponse.json({ providers });
}
