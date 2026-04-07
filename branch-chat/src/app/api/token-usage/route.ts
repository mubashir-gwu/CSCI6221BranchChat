import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { TokenUsage } from '@/models/TokenUsage';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    const usage = await TokenUsage.find({ userId: session.user.id }).lean();

    return NextResponse.json({
      usage: usage.map((u: any) => ({
        provider: u.provider,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        callCount: u.callCount,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
