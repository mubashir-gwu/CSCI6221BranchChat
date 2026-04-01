import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  providers: [], // Credentials provider added in auth.ts (requires Node.js runtime)
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) { session.user.id = token.id as string; }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = !nextUrl.pathname.startsWith('/login') &&
        !nextUrl.pathname.startsWith('/register') &&
        !nextUrl.pathname.startsWith('/api/auth');
      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl));
      }
      return true;
    },
  },
};
