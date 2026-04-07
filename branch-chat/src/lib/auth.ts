import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { authConfig } from './auth.config';
import { logger } from '@/lib/logger';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
      },
    }),
  ],
});
