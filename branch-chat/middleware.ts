import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/dashboard',
    '/chat/:path*',
    '/settings',
    '/api/conversations/:path*',
    '/api/llm/:path*',
    '/api/settings/:path*',
    '/api/import/:path*',
  ],
};
