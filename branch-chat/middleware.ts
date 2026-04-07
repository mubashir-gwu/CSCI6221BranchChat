import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/dashboard',
    '/chat/:path*',
    '/api/conversations/:path*',
    '/api/llm/:path*',
    '/api/import/:path*',
    '/api/providers/:path*',
    '/api/token-usage/:path*',
    '/usage',
  ],
};
