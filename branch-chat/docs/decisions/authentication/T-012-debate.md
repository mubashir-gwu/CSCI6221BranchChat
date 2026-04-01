# T-012 Deliberation: NextAuth v5 Configuration

## PROPOSER

I propose implementing `src/lib/auth.ts` following the exact code provided in the task breakdown. Key decisions:

1. **File**: `src/lib/auth.ts` — replaces the current stub that exports dummy GET/POST/auth functions.
2. **CredentialsProvider**: Validates email/password against MongoDB using bcrypt.compare.
3. **JWT Strategy**: No database sessions — stateless JWT tokens.
4. **Callbacks**: `jwt` callback stores `user.id` in token; `session` callback exposes `token.id` as `session.user.id`.
5. **Custom pages**: `signIn: '/login'` — redirects unauthenticated users to our login page.
6. **Exports**: `{ handlers, auth, signIn, signOut }` from `NextAuth()`.
7. **signIn server action bug**: We export `signIn` but document that it must NOT be used as a server action on Next.js 16. Only the HTTP handlers (`handlers.GET`, `handlers.POST`) are safe.
8. **Email normalization**: `toLowerCase()` on email during authorize, matching the User model's `lowercase: true`.

The catch-all route already imports from `@/lib/auth`, so we just need to ensure the exports are correct — `handlers` must destructure to `{ GET, POST }`.

## CRITIC

Concerns:

1. **The current `auth.ts` exports GET and POST directly** — the catch-all route does `export { GET, POST } from "@/lib/auth"`. But NextAuth v5 exports `handlers` which contains `{ GET, POST }`. The catch-all route needs to do `export const { GET, POST } = handlers` — but it already does that (`export { GET, POST } from "@/lib/auth"`). So `auth.ts` needs to export `GET` and `POST` directly, OR the catch-all needs updating. Since the catch-all is T-013's scope, we should just ensure `auth.ts` exports what NextAuth provides.

2. **TypeScript type augmentation**: NextAuth v5 needs module augmentation to type `session.user.id`. Without it, `session.user.id` will cause a TypeScript error. We need:
   ```typescript
   declare module "next-auth" {
     interface User { id?: string }
   }
   ```
   Actually, NextAuth v5's `User` type already has `id?: string`, so the jwt/session callbacks should work. But `session.user.id` as `string` (not `string | undefined`) may need a type assertion. Let's keep it simple with `as string`.

3. **No `signIn` server action usage**: Confirmed — we export it but won't use it directly. Client-side `signIn` from `next-auth/react` uses HTTP handlers internally.

4. **Environment variables**: `AUTH_SECRET` and `AUTH_URL` are read automatically by NextAuth v5 — no explicit config needed.

5. **connectDB import**: Uses `@/lib/db` which exports `connectDB` — matches the existing code.

## MEDIATOR

Both sides agree on the approach. Final resolution:

1. Implement `src/lib/auth.ts` with the exact code from the task breakdown.
2. Do NOT modify the catch-all route (that's T-013).
3. The build may temporarily break because the catch-all expects named `GET`/`POST` exports but `auth.ts` will now export `handlers`/`auth`/`signIn`/`signOut`. This is acceptable — T-013 will fix the catch-all.
4. To keep the build passing (acceptance criteria), we should also re-export GET and POST from handlers within auth.ts, OR update the catch-all. Since the catch-all is a trivial 1-line change and is part of T-013, the simplest approach is to temporarily re-export so the build passes.

Decision: Export `handlers`, `auth`, `signIn`, `signOut` from NextAuth. Also export destructured `GET` and `POST` from `handlers` so the existing catch-all route continues to work until T-013 refines it.
