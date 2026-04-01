# Authentication — Audit Report (Cycle 1)
Date: 2026-03-31
Tasks covered: T-011, T-012, T-013, T-014, T-015, T-016

---

## Spec Compliance

### T-011: Install NextAuth v5 and bcryptjs
| Criterion | Verdict | Evidence |
|---|---|---|
| `next-auth` version is `5.0.0-beta.30` | **PASS** | `package.json` line 22: `"next-auth": "5.0.0-beta.30"` (pinned exact) |
| `bcryptjs` version is `3.0.3` | **PASS** | `package.json` line 15: `"bcryptjs": "3.0.3"` (pinned exact) |
| `npm run build` passes | **PASS** | Build completes with all routes recognized |

### T-012: Implement NextAuth v5 Configuration
| Criterion | Verdict | Evidence |
|---|---|---|
| `auth.ts` exports `handlers`, `auth`, `signIn`, `signOut` | **PASS** | `src/lib/auth.ts:7` — destructured from `NextAuth()` |
| CredentialsProvider validates email/password against MongoDB | **PASS** | `src/lib/auth.ts:15-22` — connects to DB, finds user by email, compares password with bcrypt |
| JWT session strategy is configured | **PASS** | `src/lib/auth.ts:26` — `session: { strategy: 'jwt' }` |
| Custom sign-in page points to `/login` | **PASS** | `src/lib/auth.ts:27` — `pages: { signIn: '/login' }` |
| `npm run build` passes | **PASS** | Confirmed |

### T-013: Implement Auth Route Handlers
| Criterion | Verdict | Evidence |
|---|---|---|
| `POST /api/auth/register` with valid data returns 201 with `{ id, email }` | **PASS** | `register/route.ts:40-43` — returns `{ id: user._id.toString(), email: user.email }` with status 201 |
| Duplicate email returns 409 | **PASS** | `register/route.ts:29-35` — checks `existingUser`, returns 409 |
| Missing fields return 400 with descriptive message | **PASS** | `register/route.ts:11-16` — "Email and password are required" |
| Password under 8 chars returns 400 | **PASS** | `register/route.ts:18-23` — "Password must be at least 8 characters" |
| `POST /api/auth/callback/credentials` with valid credentials returns a session | **PASS** | `[...nextauth]/route.ts:1-2` — exports `GET`/`POST` from `handlers` |
| `npm run build` passes | **PASS** | Confirmed |

### T-014: Implement Auth Middleware
| Criterion | Verdict | Evidence |
|---|---|---|
| Unauthenticated access to `/dashboard` redirects to `/login` | **FAIL** | `middleware.ts:4` — matcher pattern `'/(protected)/:path*'` uses the route group name, but route groups are URL-invisible in Next.js. The actual URL `/dashboard` never matches this pattern. Protected page routes are unguarded. |
| Unauthenticated access to `/api/conversations` returns 401 | **PASS** | Matcher pattern `'/api/conversations/:path*'` matches actual API URLs |
| `/api/auth/register` remains accessible without auth | **PASS** | Not in matcher list |
| `/login` and `/register` pages remain accessible without auth | **PASS** | Not in matcher list |
| `npm run build` passes | **PASS** | Confirmed |

### T-015: Implement Login and Register Pages
| Criterion | Verdict | Evidence |
|---|---|---|
| Register creates account and redirects to `/dashboard` (FR-001) | **PASS** | `RegisterForm.tsx:25-53` — POSTs to register, auto-signs-in, pushes to `/dashboard` |
| Login authenticates and redirects to `/dashboard` (FR-002) | **PASS** | `LoginForm.tsx:25-35` — `signIn("credentials", { redirect: false })`, pushes to `/dashboard` on success |
| Invalid credentials show error message (FR-002) | **PASS** | `LoginForm.tsx:31-32` — "Invalid email or password" |
| Duplicate email on register shows error (FR-001) | **PASS** | `RegisterForm.tsx:34-36` — checks for 409, shows "Email already exists" |
| `npm run build` passes | **PASS** | Confirmed |

### T-016: Implement Logout Functionality
| Criterion | Verdict | Evidence |
|---|---|---|
| Clicking logout clears the session and redirects to `/login` (FR-003) | **PASS** | `(protected)/layout.tsx:18` — `signOut({ callbackUrl: "/login" })` |
| After logout, accessing `/dashboard` redirects to `/login` (FR-004) | **FAIL** | Same middleware matcher bug as T-014 — `/dashboard` is not matched by `/(protected)/:path*` |
| `npm run build` passes | **PASS** | Confirmed |

---

## Bug Detection

### BUG-1: Middleware matcher pattern does not match protected page routes (Critical)

- **File:** `middleware.ts:4`
- **Pattern:** `'/(protected)/:path*'`
- **Description:** Next.js route groups (parenthesized folder names like `(protected)`) are a file-system organization convention only — they do not appear in request URLs. The URL for the dashboard page is `/dashboard`, not `/(protected)/dashboard`. Therefore, this matcher pattern never matches any real HTTP request. Protected page routes (`/dashboard`, `/chat/[conversationId]`, `/settings`) are completely unguarded by middleware.
- **Impact:** Unauthenticated users can navigate directly to protected pages. While API calls from those pages will fail (API matchers are correct), the pages themselves render, exposing UI structure.
- **Severity:** **Critical**

### BUG-2: Register 409 error message deviates from Architecture Document (Low)

- **File:** `src/app/api/auth/register/route.ts:32`
- **Description:** Returns `"Email already exists"` but Architecture Document §5.1 specifies `"An account with this email already exists"`.
- **Severity:** **Low** — behavior is correct, only message text differs.

### BUG-3: Unnecessary handler exports in auth.ts (Low)

- **File:** `src/lib/auth.ts:40`
- **Description:** `export const { GET, POST } = handlers;` is defined in the library file. These exports are only needed in the route handler (`[...nextauth]/route.ts`), which correctly imports `handlers` and re-exports `GET`/`POST` itself. The extra exports in `auth.ts` are unused dead code.
- **Severity:** **Low** — harmless but unnecessary.

---

## Security

### SEC-1: Protected pages accessible without authentication (Critical)

- **File:** `middleware.ts`
- **Vulnerability:** Due to BUG-1, unauthenticated users can access `/dashboard`, `/chat/*`, and `/settings` pages directly. While no data will load (API routes are properly protected), the page shells and UI components are exposed.
- **Severity:** **Critical**
- **Suggested fix:** Replace `'/(protected)/:path*'` with explicit URL patterns: `'/dashboard', '/chat/:path*', '/settings'`.

### SEC-2: Auth pages don't redirect authenticated users (Low)

- **File:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`
- **Vulnerability:** Architecture Document specifies these pages should "Redirect if authenticated" but neither page checks session status. An already-logged-in user visiting `/login` sees the login form instead of being redirected to `/dashboard`.
- **Severity:** **Low** — not a security risk, but a UX issue and architecture deviation.
- **Suggested fix:** Add server-side `auth()` check at the top of each page component, redirect to `/dashboard` if session exists.

**No other security issues found:**
- API routes are protected by correct matcher patterns (conversations, llm, settings, import)
- No secrets in client-side code
- Email input is lowercased and trimmed before storage/lookup
- Password hashing uses bcrypt with 10 rounds as specified
- JWT session strategy with httpOnly cookies
- Register endpoint validates input types and lengths

---

## Architecture Alignment

| What was specified | What was implemented | Acceptable? |
|---|---|---|
| `middleware.ts` protects all `(protected)` routes and API routes | Matcher pattern `/(protected)/:path*` doesn't match actual URL paths for page routes; API route matchers are correct | **Not acceptable** — must fix matcher |
| `(auth)/login/page.tsx` — "Redirects if authenticated" | No auth check; always renders LoginForm | **Not acceptable** — should redirect authenticated users |
| `(auth)/register/page.tsx` — "Redirects if authenticated" | No auth check; always renders RegisterForm | **Not acceptable** — should redirect authenticated users |
| `src/lib/auth.ts` exports `{ handlers, auth, signIn, signOut }` | Exports those plus `{ GET, POST }` from handlers | **Acceptable** — extra exports are harmless |
| Root `layout.tsx`: AuthProvider + ToastProvider | Wraps children with `AuthProvider` then `Toaster` (sonner) | **Correct** |
| Root `page.tsx`: Redirect to `/login` or `/dashboard` | Uses server-side `auth()`, redirects accordingly | **Correct** |
| `(protected)/layout.tsx`: temporary header with logout | Has header with "BranchChat" title and "Logout" button | **Correct** |
| 409 error: "An account with this email already exists" | Returns "Email already exists" | **Minor deviation** — same semantics |

---

## Forward Compatibility

### FC-1: Middleware matcher must be fixed before F-04

- **Current code:** `middleware.ts` matcher `/(protected)/:path*`
- **Future need:** F-04 adds ConversationProvider and UIProvider to the protected layout. These providers will attempt API calls that require authentication. If unauthenticated users can reach the protected layout, the providers will encounter 401 errors with no graceful handling.
- **Assessment:** **Incompatible** — must fix before proceeding.

### FC-2: Auth page redirect needed for F-04+ UX

- **Current code:** Login/register pages don't check auth
- **Future need:** Once users are routinely logged in, navigating to `/login` or `/register` (e.g., via browser history) should redirect to `/dashboard`.
- **Assessment:** **Should fix** — minor but grows more annoying as app usage increases.

### FC-3: Auth configuration is well-structured for future features

- **Current code:** `auth.ts` exports all needed functions, JWT callbacks pass user ID
- **Future need:** F-04+ API routes will call `auth()` and access `session.user.id`
- **Assessment:** **Compatible** — good foundation.

### FC-4: Register endpoint is compatible with future needs

- **Current code:** Clean validation, proper status codes, standard response shape
- **Future need:** No changes anticipated
- **Assessment:** **Compatible**

---

## Summary

- Critical issues: **1** (middleware matcher pattern doesn't match protected page routes)
- Medium issues: **0**
- Low issues: **3** (error message text, unused exports, auth page redirect missing)
- Recommendation: **FIX FIRST**

The single critical issue — the middleware matcher — must be resolved before proceeding to F-04. The three low issues should be addressed in the same revision pass.
