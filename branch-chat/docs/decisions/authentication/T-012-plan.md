# T-012 Implementation Plan: NextAuth v5 Configuration

## File: `src/lib/auth.ts`

Replace the stub with full NextAuth v5 configuration:

1. Import NextAuth, Credentials provider, bcrypt, connectDB, User model.
2. Call `NextAuth()` with:
   - CredentialsProvider that validates email/password against MongoDB
   - JWT session strategy
   - Custom sign-in page: `/login`
   - JWT callback: stores user.id in token
   - Session callback: exposes token.id as session.user.id
3. Export `{ handlers, auth, signIn, signOut }` from the NextAuth call.
4. Also export `const { GET, POST } = handlers` so the existing catch-all route continues to work.

## Constraints
- Do NOT use signIn as a server action (Next.js 16 bug).
- Email normalized to lowercase in authorize.
- connectDB() called before any DB query.
- No modification to other files (catch-all, middleware, etc.)
