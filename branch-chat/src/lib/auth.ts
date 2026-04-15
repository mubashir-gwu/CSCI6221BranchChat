import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { CredentialsSignin } from 'next-auth';
import { connectDB, isBackendUnavailableError } from '@/lib/db';
import { User } from '@/models/User';
import { authConfig } from './auth.config';
import { logger } from '@/lib/logger';

class BackendUnavailableSignin extends CredentialsSignin {
  code = 'BackendUnavailable';
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    error(error) {
      // CredentialsSignin is the expected signal for a failed login; swallow
      // it so invalid-password attempts don't dump a stack trace to the console.
      if (error instanceof CredentialsSignin || error?.name === 'CredentialsSignin') return;
      logger.error('NextAuth error', { error: error?.message, stack: error?.stack });
    },
    warn(code) { logger.warn('NextAuth warning', { code }); },
    debug() {},
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).toLowerCase();
        logger.info('Auth: login attempt', { email });
        try {
          await connectDB();
          const user = await User.findOne({ email });
          if (!user) {
            logger.warn('Auth: login failed', { email, reason: 'user not found' });
            return null;
          }
          const isValid = await bcrypt.compare(credentials.password as string, user.hashedPassword);
          if (!isValid) {
            logger.warn('Auth: login failed', { email, reason: 'invalid password' });
            return null;
          }
          logger.info('Auth: login success', { userId: user._id.toString(), email });
          return { id: user._id.toString(), email: user.email };
        } catch (err) {
          if (isBackendUnavailableError(err)) {
            logger.error('Auth: backend unavailable during login', { email, error: (err as Error)?.message });
            throw new BackendUnavailableSignin();
          }
          throw err;
        }
      },
    }),
  ],
});
