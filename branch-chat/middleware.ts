export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    '/(protected)/:path*',
    '/api/conversations/:path*',
    '/api/llm/:path*',
    '/api/settings/:path*',
    '/api/import/:path*',
  ],
};
